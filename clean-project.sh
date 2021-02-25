# !/bin/bash

cd asset-transfer-project/application-javascript

if [ -d "wallet" ]; then
    rm -r wallet
fi

cd ../../test-network-project
./network.sh down
