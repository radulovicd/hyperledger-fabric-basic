package chaincode

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric-chaincode-go/shim"
)

// SmartContract provides functions for managing an Asset
type SmartContract struct {
	contractapi.Contract
}

type Malfunction struct {
	Description string `json:"description"`
	Price float32 `json:"price"`
}

type User struct {
	ID string `json:"ID"`
	DocType string `json:"docType"`
	FirstName string `json:"firstName"`
	LastName string `json:"lastName"`
	Email string `json:"email"`
	Balance float32 `json:"balance"`
}

type Car struct {
	ID string `json:"ID"`
	DocType string `json:"docType"`
	Brand string `json:"brand"`
	Model string `json:"model"`
	Year string `json:"year"`
	Color string `json:"color"`
	Owner string `json:"owner"`
	Price float32 `json:"price"`
	Malfunctions []Malfunction `json:"malfunctions"`
}

// InitLedger adds a base set of assets to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	users := []User {
		{ID: "user1", DocType: "user", FirstName: "Marko", LastName: "Markovic", Email: "marko@gugl.com", Balance: 9000.00},
		{ID: "user2", DocType: "user", FirstName: "Petar", LastName: "Petrovic", Email: "petar@jahu.com", Balance: 3500.00},
		{ID: "user3", DocType: "user", FirstName: "Nikola", LastName: "Nikolic", Email: "nikola@bing.com", Balance: 4000.00},
	}

	cars := []Car {
		{ID: "car1", DocType: "car", Brand: "Ferrari", Model: "F40", Year: "1990", Color: "Red", Owner: "user1", Price: 5000, Malfunctions: []Malfunction{}},
		{ID: "car2", DocType: "car", Brand: "Rolls Royce", Model: "Phantom", Year: "2018", Color: "Black", Owner: "user1", Price: 20000, Malfunctions: []Malfunction{}},
		{ID: "car3", DocType: "car", Brand: "Ford", Model: "GT40", Year: "1969", Color: "Blue", Owner: "user1", Price: 7000, Malfunctions: []Malfunction{}},
		{ID: "car4", DocType: "car", Brand: "Ford", Model: "Mustang", Year: "2020", Color: "Black", Owner: "user2", Price: 12000, Malfunctions: []Malfunction{}},
		{ID: "car5", DocType: "car", Brand: "Tesla", Model: "S", Year: "2019", Color: "White", Owner: "user2", Price: 9000, Malfunctions: []Malfunction{}},
		{ID: "car6", DocType: "car", Brand: "Mazda", Model: "6", Year: "2018", Color: "Grey", Owner: "user2", Price: 10000, Malfunctions: []Malfunction{}},
	}

	for _, user := range users {
		userJSON, err := json.Marshal(user)

		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(user.ID, userJSON)
		
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	for _, car := range cars {
		carJSON, err := json.Marshal(car)

		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(car.ID, carJSON)
		
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	return nil
}

// CreateAsset issues a new asset to the world state with given details. - Car malfunction creation.
func (s *SmartContract) AddMalfunction(ctx contractapi.TransactionContextInterface, id string, description string, price float32) error {
	car, err := s.ReadCar(ctx, id)

	if err != nil {
		return err
	}

	if price <= 0 {
		return fmt.Errorf("price can't be zero or lower")
	}

	totalMalfunctionPrice := price

	for _, malfunction := range car.Malfunctions {
		totalMalfunctionPrice += malfunction.Price
	}

	if totalMalfunctionPrice > car.Price {
		return s.DeleteAsset(ctx, id)
	}

	malfunction := Malfunction {
		Description: description, 
		Price: price,
	}

	car.Malfunctions = append(car.Malfunctions, malfunction)

	carJSON, err := json.Marshal(car)

	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, carJSON)
}

// ReadAsset returns the asset stored in the world state with given id. - Read car by id
func (s *SmartContract) ReadCar(ctx contractapi.TransactionContextInterface, id string) (*Car, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}

	if assetJSON == nil {
		return nil, fmt.Errorf("the car %s does not exist", id)
	}

	var car Car
	err = json.Unmarshal(assetJSON, &car)
	
	if err != nil {
		return nil, fmt.Errorf("couldn't find car with id %s", id)
	}

	return &car, nil
}

func (s *SmartContract) ReadUser(ctx contractapi.TransactionContextInterface, id string) (*User, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}

	if assetJSON == nil {
		return nil, fmt.Errorf("the user %s does not exist", id)
	}

	var user User
	err = json.Unmarshal(assetJSON, &user)

	if err != nil {
		return nil, fmt.Errorf("couldn't find user with id %s", id)
	}

	return &user, nil
}

// UpdateAsset updates an existing asset in the world state with provided parameters. - Car color change
func (s *SmartContract) ChangeColor(ctx contractapi.TransactionContextInterface, id string, color string) error {
	car, err := s.ReadCar(ctx, id)

	if err != nil {
		return err
	}
	
	car.Color = color

	carJSON, err := json.Marshal(car)

	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(car.ID, carJSON)
}

// DeleteAsset deletes an given asset from the world state.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, id string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the asset %s does not exist", id)
	}

	return ctx.GetStub().DelState(id)
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

// TransferAsset updates the owner field of asset with given id in world state.
func (s *SmartContract) BuyCar(ctx contractapi.TransactionContextInterface, id string, newOwner string, flag bool) error {
	car, err := s.ReadCar(ctx, id)

	if err != nil {
		return err
	}

	oldUSer, ouErr := s.ReadUser(ctx, car.Owner)

	if ouErr != nil {
		return ouErr
	}

	newUser, nuErr := s.ReadUser(ctx, newOwner)

	if nuErr != nil {
		return nuErr
	}

	var mfCosts float32 = 0
	carTotalPrice := car.Price
	for _, mf := range car.Malfunctions {
		mfCosts += mf.Price
	}

	if mfCosts > 0 {
		if flag {
			carTotalPrice -= mfCosts
		} else {
			return fmt.Errorf("car purhcase has been canceled due to car malfunctions")
		}
	}

	if newUser.Balance < carTotalPrice {
		return fmt.Errorf("user %s doesn't have enough money for purchase", newOwner)
	}

	newUser.Balance -= carTotalPrice
	oldUSer.Balance += carTotalPrice
	car.Owner = newOwner

	oldUSerJSON, ouErr := json.Marshal(oldUSer)
	if ouErr != nil {
		return ouErr
	}
	ctx.GetStub().PutState(oldUSer.ID, oldUSerJSON)

	newUSerJSON, nuErr := json.Marshal(newUser)
	if nuErr != nil {
		return nuErr
	}
	ctx.GetStub().PutState(newOwner, newUSerJSON)

	carJSON, err := json.Marshal(car)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, carJSON)
}

func (s *SmartContract) FixCar(ctx contractapi.TransactionContextInterface, id string) error {
	car, err := s.ReadCar(ctx, id)

	if err != nil {
		return err
	}

	owner, oErr := s.ReadUser(ctx, car.Owner)

	if oErr != nil {
		return oErr
	}

	mechanic, mErr := s.ReadUser(ctx, "user3")

	if mErr != nil {
		return mErr
	}

	var price float32 = 0
	for _, mf := range car.Malfunctions {
		price += mf.Price
	}

	if owner.Balance < price {
		return fmt.Errorf("user %s doesn't have enough money for repair costs", owner.ID)
	}

	car.Malfunctions = []Malfunction{}

	owner.Balance -= price
	mechanic.Balance += price

	ownerJSON, oErr := json.Marshal(owner)
	if oErr != nil {
		return oErr
	}
	ctx.GetStub().PutState(owner.ID, ownerJSON)

	mechanicJSON, mErr := json.Marshal(mechanic)
	if mErr != nil {
		return mErr
	}
	ctx.GetStub().PutState(mechanic.ID, mechanicJSON)

	carJSON, err := json.Marshal(car)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, carJSON)
}

func (s *SmartContract) QueryAssetsByColor(ctx contractapi.TransactionContextInterface, color string) ([]*Car, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"car","color":"%s"}}`, color)
	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) QueryAssetsByOwner(ctx contractapi.TransactionContextInterface, owner string) ([]*Car, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"car","owner":"%s"}}`, owner)
	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) QueryAssetsByColorAndOwner(ctx contractapi.TransactionContextInterface, color string, owner string) ([]*Car, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"car","color":"%s", "owner":"%s"}}`, color, owner)
	return getQueryResultForQueryString(ctx, queryString)
}

func (s *SmartContract) QueryAssets(ctx contractapi.TransactionContextInterface, queryString string) ([]*Car, error) {
	return getQueryResultForQueryString(ctx, queryString)
}


func getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string) ([]*Car, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)

	if err != nil {
		return nil, err
	}

	defer resultsIterator.Close()

	return constructQueryResponseFromIterator(resultsIterator)
}

func constructQueryResponseFromIterator(resultsIterator shim.StateQueryIteratorInterface) ([]*Car, error) {
	var cars []*Car

	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()

		if err != nil {
			return nil, err
		}

		var car Car
		err = json.Unmarshal(queryResult.Value, &car)

		if err != nil {
			return nil, err
		}

		cars = append(cars, &car)
	}

	return cars, nil
}
