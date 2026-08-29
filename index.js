var start = require("./src/main").start;

start().catch(function (error) {
  console.error("[fatal] startup failure", error);
  process.exit(1);
});
