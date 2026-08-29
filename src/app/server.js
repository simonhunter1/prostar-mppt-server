var express = require("express");
var http = require("http");
var socketIo = require("socket.io");

function createServer() {
  var app = express();
  var httpServer = http.Server(app);
  var io = socketIo(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    },
  });

  return {
    app: app,
    httpServer: httpServer,
    io: io,
  };
}

function registerCors(app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });
}

module.exports = {
  createServer: createServer,
  registerCors: registerCors,
};
