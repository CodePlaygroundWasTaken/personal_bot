const {NodeVM} = require("vm2")
let parsed = JSON.parse(process.argv[3])
const vm = new NodeVM({
  sandbox: {parsed},
  require: {
    external: {
      modules: ["discord.js"]
    }
  }
});
vm.run(parsed.runner, "vm.js");
