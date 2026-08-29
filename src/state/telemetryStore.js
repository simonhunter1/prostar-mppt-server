function createTelemetryStore() {
  var snapshot = {};
  var pollCount = 0;
  var lastTelemetryAt = null;

  return {
    incrementPoll: function () {
      pollCount += 1;
      return pollCount;
    },

    getPollCount: function () {
      return pollCount;
    },

    hasData: function () {
      return Object.keys(snapshot).length > 0;
    },

    getSnapshot: function () {
      return snapshot;
    },

    setSnapshot: function (data) {
      snapshot = data || {};
      lastTelemetryAt = new Date().toISOString();
    },

    getLastTelemetryAt: function () {
      return lastTelemetryAt;
    },
  };
}

module.exports = {
  createTelemetryStore: createTelemetryStore,
};
