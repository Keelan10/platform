The current 2.0-alpha runs local Datastores and Hero instances, and allows remote Hero instances to be run over Websockets.

The initial “Cloud” service will be deployed as a network of hosted Rigs (there will be multiple Rigs?)

## 2.0 - Run On Localhost


## 2.1 - First Remote Deployment
We need capabilities to deploy, remove and run remote Datastores.
[x] Endpoint uploading and installing a Datastore
[x] Endpoint for running a local-on-the-service datastore using the Packaged Datastore hash
[x] Docker that runs on Cloud

## 2.2 - Support Payment Wall
Long-term this will hold the code for creating, submitting, and tracking blocks on the chain. Short-term this will have a single latestBlock endpoint that returns the latest generated block. 
This adds support for Datastores that want to add a payment. It will require Runner queries to contain a payment token, validate that payment tokens are from a trusted source before processing, and upon successful completion of the query, the Server will settle the transaction with the Sidechain.
[x] Sidechain verification
[x] Mainchain Module
[x] Payments Module

## 2.3 - First Network Cluster
Miner should be able to operate as a load balancer for a series of other servers. You might also ask a server what other servers were available in the network. Each could operate as a load balancer and knew workloads of its cluster members so it could properly distribute new tasks. Some nodes may also operate as a “rig” and provide a set of services such as providing a public IP and connecting into the decentralized network.
- Load Balancing of Cluster
- Miner Registration    

## 2.4 - Services and Management
The Miner ecosystem needs to support a few services for IP Rotation and Catpcha solving. We want to have a plugin infrastructure where developers can choose their own, but we will also provide some defaults.
We need APIs to get statistics on how often different Datastores have been hit, and how accurate the data has been.
- External Service - IP Proxy Service
- External Service - Catpcha Breaker Service
- Miner Management - Endpoint Statistics
- Miner Management - SessionDB Retrieval


# UNVERSIONED

## Deployment Scripting
We want to consider supporting one or more infrastructure scripting languages as well.
- Chef
- Terraform

## P2P Modules
Rigs have network services so that Miners can be simple Datastore runners.
P2P Storage Lookup/Index
P2P Network Lookups

## Deploy to Multiple Clouds
We want to provide one click deployment options for Miner across various platforms.
AWS Lambda
Google Cloud Functions
Digital Ocean
Heroku
Kubernetes
