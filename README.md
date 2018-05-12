# prostar-mppt-server
Communicates with Morningstar Prostar MPPT solar charge controller and reads Modbus data. See how your solar array and battery are performing! Can be logged to a NoSQL database too like Firebase or MongoDB.

You need:
* A Morningstar Prostar MPPT Solar Charge Controller (any Morningstar controller should work, you'll just have to reconfigure the modbus registers
* Morningstar's USB adapter

## Getting Started ##
Run the index.js file. It will poll the charge controller and emit messages through websockets that you can hook into.
