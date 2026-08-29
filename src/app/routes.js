var path = require("path");

function registerRoutes(app, options) {
  var telemetryStore = options.telemetryStore;
  var getProtocol = options.getProtocol;
  var getClientCount = options.getClientCount;
  var indexHtmlPath = options.indexHtmlPath;

  app.get("/", function (_req, res) {
    res.sendFile(indexHtmlPath || path.join(process.cwd(), "index.html"));
  });

  app.get("/api/health", function (_req, res) {
    res.json({
      ok: true,
      protocol: getProtocol(),
      connectedClients: getClientCount(),
      pollCount: telemetryStore.getPollCount(),
    });
  });

  app.get("/api/status", function (_req, res) {
    if (!telemetryStore.hasData()) {
      res.status(503).json({
        error: "No telemetry available yet",
        protocol: getProtocol(),
      });
      return;
    }

    res.json({
      protocol: getProtocol(),
      pollCount: telemetryStore.getPollCount(),
      updatedAt: telemetryStore.getLastTelemetryAt(),
      data: telemetryStore.getSnapshot(),
    });
  });
}

module.exports = {
  registerRoutes: registerRoutes,
};
