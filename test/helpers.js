const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(relativePath, scope = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const context = vm.createContext(scope);
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return context;
}

module.exports = { loadScript };
