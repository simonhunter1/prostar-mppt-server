# prostar-mppt-server

Communicates with Morningstar Prostar MPPT solar charge controller and reads Modbus data. See how your solar array and battery are performing! Can be logged to a NoSQL database too like Firebase or MongoDB.

You need:

- A Morningstar Prostar MPPT Solar Charge Controller (any Morningstar controller should work, you'll just have to reconfigure the modbus registers
- Morningstar's USB adapter

## Getting Started

Run the index.js file. It will poll the charge controller and emit messages through websockets that you can hook into.

## Protocol Configuration

The server now supports both `modbus` and `meterbus` modes.

Default mode is `modbus`.

### Run in Modbus mode (default)

```bash
PROTOCOL=modbus SERIAL_PORT=/dev/tty.usbserial-DN008CH0 npm run start
```

Optional Modbus settings:

- `MODBUS_BAUD_RATES` (comma-separated, default `9600,19200,38400`)
- `MODBUS_SLAVE_IDS` (comma-separated, default `1,2,3,4,5`)
- `MODBUS_TEST_ADDRESSES` (comma-separated decimal/hex, default `0x0008,0x0010,0x0000`)
- `MODBUS_DATABITS` (default `8`)
- `MODBUS_PARITY` (default auto-scan profiles include `none` and `even`)
- `MODBUS_STOPBITS` (default auto-scan profiles include `1` and `2`)
- `MODBUS_TIMEOUT_MS` (default `3000`)

If your USB adapter is detected but the controller does not respond, force one known framing profile at a time:

```bash
# Typical Modbus RTU profile
PROTOCOL=modbus SERIAL_PORT=/dev/tty.usbserial-DN008CH0 MODBUS_PARITY=even MODBUS_STOPBITS=1 npm run start

# Common no-parity profile
PROTOCOL=modbus SERIAL_PORT=/dev/tty.usbserial-DN008CH0 MODBUS_PARITY=none MODBUS_STOPBITS=2 npm run start
```

The scanner now treats Modbus exception replies as proof that physical communication is working,
which helps distinguish "wrong register/function" from "no link".

### Run in MeterBus mode

`METERBUS_REQUEST_HEX` is required. This should be the raw request frame in hex for your controller and command.

```bash
PROTOCOL=meterbus \
SERIAL_PORT=/dev/tty.usbserial-DN008CH0 \
METERBUS_BAUD=9600 \
METERBUS_REQUEST_HEX=aa010055 \
npm run start
```

Optional MeterBus settings:

- `METERBUS_DATABITS` (default `8`)
- `METERBUS_STOPBITS` (default `1`)
- `METERBUS_PARITY` (default `none`)
- `METERBUS_RESPONSE_WAIT_MS` (default `600`)

Notes:

- Modbus data is parsed into named fields (`arrayVoltage`, `batteryVoltage`, etc.).
- MeterBus mode currently returns raw response bytes (`rawHex`) so you can confirm connectivity and frame content before adding model-specific parsing.
