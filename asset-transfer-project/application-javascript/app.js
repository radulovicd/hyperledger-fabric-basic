/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg3, buildWallet } = require('../../test-application/javascript/AppUtil.js');

const channelName = 'mychannel';
const chaincodeName = 'basic';
const mspOrg3 = 'Org3MSP';
const walletPath = path.join(__dirname, 'wallet');
const org3UserId = 'appUser';

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

// pre-requisites:
// - fabric-sample two organization test-network setup with two peers, ordering service,
//   and 2 certificate authorities
//         ===> from directory /fabric-samples/test-network
//         ./network.sh up createChannel -ca
// - Use any of the asset-transfer-basic chaincodes deployed on the channel "mychannel"
//   with the chaincode name of "basic". The following deploy command will package,
//   install, approve, and commit the javascript chaincode, all the actions it takes
//   to deploy a chaincode to a channel.
//         ===> from directory /fabric-samples/test-network
//         ./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-javascript/ -ccl javascript
// - Be sure that node.js is installed
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         node -v
// - npm installed code dependencies
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         npm install
// - to run this test application
//         ===> from directory /fabric-samples/asset-transfer-basic/application-javascript
//         node app.js

// NOTE: If you see  kind an error like these:
/*
    2020-08-07T20:23:17.590Z - error: [DiscoveryService]: send[mychannel] - Channel:mychannel received discovery error:access denied
    ******** FAILED to run the application: Error: DiscoveryService: mychannel error: access denied

   OR

   Failed to register user : Error: fabric-ca request register failed with errors [[ { code: 20, message: 'Authentication failure' } ]]
   ******** FAILED to run the application: Error: Identity not found in wallet: appUser
*/
// Delete the /fabric-samples/asset-transfer-basic/application-javascript/wallet directory
// and retry this application.
//
// The certificate authority must have been restarted and the saved certificates for the
// admin and application user are not valid. Deleting the wallet store will force these to be reset
// with the new certificate authority.
//

/**
 *  A test application to show basic queries operations with any of the asset-transfer-basic chaincodes
 *   -- How to submit a transaction
 *   -- How to query and check the results
 *
 * To see the SDK workings, try setting the logging to show on the console before running
 *        export HFC_LOGGING='{"debug":"console"}'
 */
async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg3();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org3.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		await enrollAdmin(caClient, wallet, mspOrg3);

		// in a real application this would be done only when a new user was required to be added
		// and would be part of an administrative flow
		await registerAndEnrollUser(caClient, wallet, mspOrg3, org3UserId, 'org3.department1');

		// Create a new gateway instance for interacting with the fabric network.
		// In a real application this would be done as the backend server session is setup for
		// a user that has been verified.
		const gateway = new Gateway();

		try {
			// setup the gateway instance
			// The user will now be able to create connections to the fabric network and be able to
			// submit transactions and query. All transactions submitted by this gateway will be
			// signed by this user using the credentials stored in the wallet.
			await gateway.connect(ccp, {
				wallet,
				identity: org3UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			// Build a network instance based on the channel where the smart contract is deployed
			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// Initialize a set of asset data on the channel using the chaincode 'InitLedger' function.
			// This type of transaction would only be run once by an application the first time it was started after it
			// deployed the first time. Any updates to the chaincode deployed later would likely not need to run
			// an "init" type function.
			console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			await contract.submitTransaction('InitLedger');
			console.log('*** Result: committed');

			console.log('\n--> Evaluate Transaction: ReadCar, function returns car1');
			let result = await contract.evaluateTransaction('ReadCar', 'car1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);
			
			// change color of specified car
			console.log('\n--> Submit Transaction: ChangeColor, function changes color of car1 to Black');
			await contract.submitTransaction('ChangeColor', 'car1', 'Black');
			console.log('*** Result: committed');

			// different types of queries
			console.log('\n--> Evaluate Transaction: QueryAssetsByColor, function returns all black cars');
			result = await contract.evaluateTransaction('QueryAssetsByColor', 'Black');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: QueryAssetsByOwner, function returns all cars owned by user1');
			result = await contract.evaluateTransaction('QueryAssetsByOwner', 'user1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: QueryAssetsByColorAndOwner, function returns all black cars owned by user2');
			result = await contract.evaluateTransaction('QueryAssetsByColorAndOwner', 'Black', 'user2');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: QueryAssets, function returns all mustang model cars');
			result = await contract.evaluateTransaction('QueryAssets', '{\"selector\":{\"model\":\"Mustang\"}}');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			// add malfunction to car
			try {
				console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car1');
			await contract.submitTransaction('AddMalfunction', 'car1', 'Flat tires', '-850');
			console.log('*** Result: committed');
			} catch (error) {
				console.log(`*** Successfully caught the error: \n    ${error}`);
			}

			console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car1');
			await contract.submitTransaction('AddMalfunction', 'car1', 'Flat tires', '850');
			console.log('*** Result: committed');

			console.log('\n--> Evaluate Transaction: ReadCar, function returns car1');
			result = await contract.evaluateTransaction('ReadCar', 'car1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);
			
			// fix car and check balance of users involved and car malfunction record
			console.log('\n--> Evaluate Transaction: ReadUser, function returns user1 - owner of car1');
			result = await contract.evaluateTransaction('ReadUser', 'user1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: ReadUser, function returns user3 - mechanic');
			result = await contract.evaluateTransaction('ReadUser', 'user3');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Submit Transaction: FixCar, function deletes all malfunctions from car1');
			await contract.submitTransaction('FixCar', 'car1');
			console.log('*** Result: committed');

			console.log('\n--> Evaluate Transaction: ReadCar, function returns car1');
			result = await contract.evaluateTransaction('ReadCar', 'car1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: ReadUser, function returns user1 - owner of car1');
			result = await contract.evaluateTransaction('ReadUser', 'user1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: ReadUser, function returns user3 - mechanic');
			result = await contract.evaluateTransaction('ReadUser', 'user3');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			// add malfunction over the price of its car and check if car has been deleted
			console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car6');
			await contract.submitTransaction('AddMalfunction', 'car6', 'Engine issues', '11000');
			console.log('*** Result: committed');

			try {
				console.log('\n--> Submit Transaction: Read car6 to check if it has been deleted');
				await contract.evaluateTransaction('ReadCar', 'car6');
				console.log('******** FAILED to return an error');
			} catch (error) {
				console.log(`*** Successfully caught the error: \n    ${error}`);
			}

			// add malfunctions to car and test buying options
			console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car5');
			await contract.submitTransaction('AddMalfunction', 'car5', 'Broken windshields', '5000');
			console.log('*** Result: committed');

			console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car5');
			await contract.submitTransaction('AddMalfunction', 'car5', 'Charging issues', '1500');
			console.log('*** Result: committed');

			console.log('\n--> Evaluate Transaction: ReadCar, function returns car5 - checking for price and malfunction costs');
			result = await contract.evaluateTransaction('ReadCar', 'car5');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			try {
				console.log('\n--> Buy Car: transfers ownership of car car5 to user1');
				await contract.submitTransaction('BuyCar', 'car5', 'user1', false);
				console.log('*** Result: committed');
			} catch (error) {
				console.log(`*** Successfully caught the error: \n    ${error}`);
			}

			console.log('\n--> Buy Car: transfers ownership of car car5 to user1');
			await contract.submitTransaction('BuyCar', 'car5', 'user1', true);
			console.log('*** Result: committed');

			console.log('\n--> Evaluate Transaction: ReadCar, function returns car5 - checking in purches has been successfull');
			result = await contract.evaluateTransaction('ReadCar', 'car5');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: ReadUser, function returns user1 - new owner of car5');
			result = await contract.evaluateTransaction('ReadUser', 'user1');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			console.log('\n--> Evaluate Transaction: ReadUser, function returns user2 - balance check');
			result = await contract.evaluateTransaction('ReadUser', 'user2');
			console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			try {
				console.log('\n--> Buy Car: transfers ownership of car4 to user1');
				await contract.submitTransaction('BuyCar', 'car4', 'user1', false);
				console.log('*** Result: committed');
			} catch (error) {
				console.log(`*** Successfully caught the error: \n    ${error}`);
			}

			// add malfunction to car and check if owner has money to fix it
			console.log('\n--> Submit Transaction: AddMalfunction, function adds malfunction to car2');
			await contract.submitTransaction('AddMalfunction', 'car2', 'Water leaks', '15000');
			console.log('*** Result: committed');

			try {
				console.log('\n--> Submit Transaction: FixCar, function deletes all malfunctions from car2');
				await contract.submitTransaction('FixCar', 'car2');
				console.log('*** Result: committed');

			} catch (error) {
				console.log(`*** Successfully caught the error: \n    ${error}`);
			}


		} finally {
			// Disconnect from the gateway when the application is closing
			// This will close all connections to the network
			gateway.disconnect();
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
	}
}

main();
