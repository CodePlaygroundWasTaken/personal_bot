const esprima = require("esprima")

function isCalledProcess(node) {
  return ((node.type === 'CallExpression') &&
      (node.callee.type === 'MemberExpression') &&
      (node.callee.object.type === 'Identifier') &&
      (node.callee.object.name === 'process'))
}

function isStaticProcess(node){
  return ((node.type === "MemberExpression") &&
        (node.object.type === "Identifier") &&
        (node.object.name === "process"))
}

function isFuncProcess(node){
  return ((node.type === "FunctionDeclaration") && 
          (node.params.find(elem => elem.type === "Identifier")) &&
          (node.params.find(elem => elem.name === "process")))
}

function isClient(node){
  return ((node.type === "MemberExpression") &&
          (node.object.type === "Identifier") &&
          (node.object.name === "msg") &&
          (node.property.type === "Identifier") &&
          (node.property.name === "client"))
}

function removeProcess(source) {
  let returner = true
  esprima.parseScript(source, {}, function (node, meta) {
    if (isCalledProcess(node) || isFuncProcess(node) || isStaticProcess(node)) {
      returner = false
    }
  })
  return returner
}

function removeClient(source){
  let returner = true
  esprima.parseScript(source, {}, function (node, meta) {
    if (isClient(node)) {
      returner = false
    }
  })
  return returner
}



const check = (nodes, vars, funcs, name, off) => {
  let ranges = []
  let norange = []
  console.log(funcs)
  for (func of funcs) {
    console.log(func.range)
    norange.push(func.range)
  }
  nodes.forEach(node => {
    //console.log(norange)
    for (i of norange) {
      if (i[0] < node.range[0] && node.range[0] < i[1]) {
        //console.log(i[0], node.range[0], i[1])
        return
      }
    }
    if (node.type === "Identifier") {
      //console.log(node)
      if (node.name != name) {
        if (vars.find(element => {
          if (element.declarations[0].id === node) return element
        })){
          ranges.push(vars.find(element => {
            if (element.declarations[0].id === node) return element
          }).range)
        }
        else if (funcs.find(element => {
          if (element.id === node) return element
        })) {
          ranges.push(funcs.find(element => {
            if (element.id === node) return element.range
          }).range)
        }
      }
    }
  })
  return ranges
}

function parse(code, name){
  let nodes = []
  let vars = []
  let funcs = []
  esprima.parseScript(code, {comment: true, range: true}, (node, meta) => {
    //console.log(node)
    if (node.type === "VariableDeclaration") {
      vars.push(node)
    }
    else if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
      funcs.push(node)
    }
    nodes.push(node)
  })
  let ranges = check(nodes, vars, funcs, name)
  console.log(ranges)
  let addon = `\n`
  for (i of ranges) {
    addon += `${code.slice(i[0], i[1])}\n`
  }
  return addon
}

const getFunc = (script, looking) => {
  let returnee = null
  esprima.parseScript(script, {comment: true, range: true}, (node, meta) => {
    if (node.type === "FunctionDeclaration"){
      if (node.id.name === looking){
        console.log(node)
        if (node.params.length != 1){
          return returnee = "Invalid number of inputs."
        }
        let pureFunc = script.slice(node.range[0], node.range[1])
        console.log(pureFunc)
        return returnee = node.range
      }
    }
  })
  return returnee
}

module.exports = {
  getFunc,
  parse,
  check,
  removeClient,
  removeProcess
}

