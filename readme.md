# JMessage

JMessage is available for public use at trulycalc.com.  Only follow the below steps if you're interested in running a custom instance.

To host JMessage locally, pull the code from the github repository and perform the following steps:

1. CD into the code directory by running ```cd Code```
2. Install all packages by running ```npm i```
3. Create a file in the Code directory named ```.env```
4. Travel to mongodb.com and create a new database instance.  Locate your connection string, then paste it into the .env file:
```DBURI='your_connection_string'````
5. Follow the steps listed in the official Ion documentation to create a new authentication application: https://guides.tjhsst.edu/ion/using-ion-oauth
 - Make sure the client type is set to "confidential"
 - Make sure the authorization grant type is set to "authorization-code"
 - Make sure to include "http://localhost:3000/auth/ion/callback" in the redirect uri's
6. Paste both the resulting client ID and secret into your ```.env```:
```
OAUTHCLIENTID='your_client_id'
OAUTHCLIENTSECRET='your_client_secret'
```
7. Run ```npm run start```
8. Travel to http://localhost:3000.  Enjoy!