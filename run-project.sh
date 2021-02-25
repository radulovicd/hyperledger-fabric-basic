# !/bin/bash

cd test-network-project
./network.sh up createChannel -ca -s couchdb
./network.sh deployCC -ccn basic -ccp ../asset-transfer-project/chaincode-go -ccl go
