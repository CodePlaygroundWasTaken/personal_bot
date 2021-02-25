const Discord = require('discord.js');
const esprima = require("esprima")
const bot = new Discord.Client();
const { classToPlain } = require("class-transformer")
const firebase = require("firebase");
const GithubContent = require("github-content")
require("firebase/firestore");
const {
	chunkString,
	getFromBetween,
	sendErr
} = require("./helper.js")

const {
	getFunc,
	parse,
	check,
	removeClient,
	removeProcess
} = require("./parsers.js")

bot.login(process.env.TOKEN)

async function getGuild(id) {
	let name = await bot.guilds.fetch(id).then(guild => guild.name)
	return name
}

var firebaseConfig = {
	apiKey: process.env.apiKey,
	authDomain: process.env.authDomain,
	databaseURL: process.env.databaseURL,
	projectId: process.env.projectId,
	storageBucket: process.env.storageBucket,
	messagingSenderId: process.env.messagingSenderId,
	appId: process.env.appId,
	measurementId: process.env.measurementId
};

firebase.initializeApp(firebaseConfig)

let db = firebase.firestore()

let userGenerated = {}

try {
	db.collection("commands").get().then(querySnapshot => {
		querySnapshot.forEach(doc => {
			userGenerated[doc.id] = doc.data()
		})
	})
}
catch (e) {
	console.log(e)
}

let currid = null

bot.on("message", async (msg) => {
	let waiting = false
	let authormatch = false
	let currname = null
	if (userGenerated[msg.guild.id]) {
		Object.values(userGenerated[msg.guild.id]).forEach((value, i) => {
			if (value.status === "Waiting...") {
				waiting = true
				currname = Object.keys(userGenerated[msg.guild.id])[i]
			}
			if (msg.author.username === value.createdBy[0]) {
				authormatch = true
			}
		})
	}
	if (msg.mentions.has(bot.user) && waiting && authormatch && msg.content.includes("\`")) {
		let code
		let funcname
		try {
			code = getFromBetween.get(msg.content, "\`\`\`", "\`\`\`")[0]
			code = code.slice(code.split("(")[0].indexOf("function"))
			funcname = getFromBetween.get(code, "function", "(")
		}
		catch (e) {
			msg.channel.send("Invalid code.")
		}
		try {
			esprima.parseScript(code)
		}
		catch (e) {
			return sendErr(e, msg)
		}
		if (!removeProcess(code)) return msg.channel.send("Please do not use process. variables in the code.")
		if (!removeClient(code)) return msg.channel.send("Please do not use msg.client in the code.")
		let mcode = `
      const Discord = require("discord.js") 
      const bot = new Discord.Client()

      bot.login("${process.env.TOKEN}")

      ${code}

      bot.on("ready", async () => {
        try {
          let mmsg = await bot.channels.fetch(parsed.msg.cid)
          let b = await mmsg.messages.fetch(parsed.msg.mid)
          ${funcname}(b)
        }
        catch(e){
          console.log(e)
        }
      })`
		userGenerated[msg.guild.id][currname] = {
			...userGenerated[msg.guild.id][currname], ...{
				status: "Alive",
				runner: mcode,
				printer: code
			}
		}
		msg.channel.send(`Command ${currname} set!`)
		db.collection("commands").doc(`${msg.guild.id}`).set(classToPlain(userGenerated[msg.guild.id]))
	}
	if (msg.content.toLowerCase().indexOf(process.env.PREFIX) !== 0) return;
	const args = msg.content.slice(process.env.PREFIX).trim().split(/ +/g);
	const commandName = args.shift().toLowerCase()
	if (args[0] === "addCommand") {
    if (!args[1]) return msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
		if (waiting) return msg.channel.send("You must complete one command before starting another one.")
		if (userGenerated[msg.guild.id]) {
			if (Object.keys(userGenerated[msg.guild.id]).includes(args[1])) return msg.channel.send("This command already exists.")
		}
		if (!msg.member.roles.cache.find(role => role.name = "Command Creator")) return msg.channel.send("You do not have the permissions to use this command.")
		try {
			userGenerated[msg.guild.id][args[1]] = {
				status: 'Waiting...',
				createdBy: [msg.author.username],
				help: getFromBetween.get(msg.content, "'", "'") || "none"
			}
		}
		catch (e) {
			userGenerated[msg.guild.id] = {}
			userGenerated[msg.guild.id][args[1]] = {
				status: 'Waiting...',
				createdBy: [msg.author.username],
				help: getFromBetween.get(msg.content, "'", "'") || "none"
			}
		}
		return msg.channel.send("Provide a function for this command (make sure to put it in a code block and mention the bot):")
	}
	else if (args[0] === "cancelCommand") {
		if (!waiting) return msg.channel.send("There is no command to cancel.")
		if (!msg.member.roles.cache.find(role => role.name = "Command Creator")) return msg.channel.send("You do not have the permissions to use this command.")
		delete userGenerated[msg.guild.id][currname]
		return msg.channel.send(`Command ${currname} canceled!`)
	}
	else if (args[0] === "deleteCommand") {
    if (!args[1]) return msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
		if (!msg.member.roles.cache.find(role => role.name = "Command Creator")) return msg.channel.send("You do not have the permissions to use this command.")
		if (args[1] && userGenerated[msg.guild.id][args[1]]) {
			delete userGenerated[msg.guild.id][args[1]]
      db.collection("commands").doc(`${msg.guild.id}`).set(classToPlain(userGenerated[msg.guild.id]))
			return msg.channel.send(`Command ${args[1]} deleted!`)
		}
		else {
			return msg.channel.send("This command does not exist.")
		}
	}
  else if (args[0] === "addCommandFromServer") {
    if (waiting) return msg.channel.send("You must complete one command before starting another one.")
    if (!((args[1]) && (args[2]) && (args[3]))) return msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
    if (Object.keys(userGenerated[msg.guild.id]).includes(args[3])) return msg.channel.send("This command already exists.")
    if (!(userGenerated[args[1]])) return msg.channel.send("This server is does not have Personal Bot in it.")
    if (!(userGenerated[args[1]][args[2]])) return msg.channel.send("This server dose not have that command.")
    userGenerated[msg.guild.id][args[3]] = {
			...userGenerated[args[1]][args[2]], ...{
				createdBy: [userGenerated[args[1]][args[2]].createdBy[0], msg.author.username],
        help: getFromBetween.get(msg.content, "'", "'") || userGenerated[args[1]][args[2]].help
			}
		}
		msg.channel.send(`Command ${args[3]} set!`)
		db.collection("commands").doc(`${msg.guild.id}`).set(classToPlain(userGenerated[msg.guild.id]))
  }
	else if (args[0] === "resetCommand") {
    if (!args[1]) return msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
		if (!msg.member.roles.cache.find(role => role.name = "Command Creator")) return msg.channel.send("You do not have the permissions to use this command.")
		if (waiting) return msg.channel.send("You must complete one command before starting another one.")
		if (!userGenerated[msg.guild.id]) return msg.channel.send("This command does not exist yet. Use addCommand to create a command.")
		if (!Object.keys(userGenerated[msg.guild.id]).includes(args[1])) return msg.channel.send("This command does not exist yet. Use addCommand to create a command.")
		userGenerated[msg.guild.id][args[1]] = {
			status: 'Waiting...',
			createdBy: [msg.author.username],
      help: getFromBetween.get(msg.content, "'", "'") || "none"
		}
		return msg.channel.send("Provide a new function for this command (make sure to put it in a code block and mention the bot):")
	}
	else if (args[0] === "commands" || args[0] === "help") {
    console.log(args[1], Object.keys(userGenerated[msg.guild.id]))
    if (typeof args[1] !== "undefined"){
      if (args[1] === "addCommand") {
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("addCommand")
          .addFields(
            {name: "Description:", value: "Add a command to the bot. After your original message, put the code for your command in a code block and make sure to mention the bot."},
            {name: "Example usage", value: "\`pb addCommand <command name> '<command help>'\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "cancelCommand") {
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("cancelCommand")
          .addFields(
            {name: "Description:", value: "Cancels the creation of a command if one is currently in progress."},
            {name: "Example usage", value: "\`pb cancelCommand\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "deleteCommand") {
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("deleteCommand")
          .addFields(
            {name: "Description:", value: "Deletes a command, erasing it from the bot."},
            {name: "Example usage", value: "\`pb deleteCommand <command name>\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "resetCommand"){
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("deleteCommand")
          .addFields(
            {name: "Description:", value: "Resets a command, deleting the code."},
            {name: "Example usage", value: "\`pb resetCommand <new command name> '<new command help>'\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "addCommandFromServer"){
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("addCommandFromServer")
          .addFields(
            {name: "Description:", value: "Adds a command from a server of your choice."},
            {name: "Example usage", value: "\`pb addCommandFromServer <server id> <old command name> <new command name> '<new command help>'\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "commands" || args[1] === "help"){
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("commands/help")
          .addFields(
            {name: "Description:", value: "Gives you a help command, with either 1 or all commands."},
            {name: "Example usage", value: "\`pb commands <optional: command name> / pb help <optional: command name>\`"}
          )
        return msg.channel.send(embed)
      }
      else if (args[1] === "addCommandFromRepo") {
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle("addCommandFromRepo")
          .addFields(
            {name: "Description:", value: "Gets a command from a Github repo fo your choice."},
            {name: "Example usage", value: "\`pb addCommandFromRepo <repo owner>/<repo name> <file name> <function name in repo> <command name> '<command help>'\`"}
          )
        return msg.channel.send(embed)
      }
      else if (Object.keys(userGenerated[msg.guild.id]).includes(args[1])){
        let index = Object.keys(userGenerated[msg.guild.id]).indexOf(args[1])
        const embed = new Discord.MessageEmbed()
          .setColor("#0099ff")
          .setTitle(`Command: ${args[1]}`)
        try {
          embed.addField("Help:", Object.values(userGenerated[msg.guild.id])[index].help[0] || "none", true)
        }
        catch {
          embed.addField("Help:", "none", true)
        }
        embed.addFields(
            {name: "Status:", value: Object.values(userGenerated[msg.guild.id])[index].status},
            {name: "Code:", value: `\`\`\`\n${Object.values(userGenerated[msg.guild.id])[index].printer} \n\`\`\``},
            {name: "Created by:", value: Object.values(userGenerated[msg.guild.id])[index].createdBy.join(", ")},
            {name: "Example usage:", value: `\`pb ${args[1]}\``},
          )
        msg.channel.send(embed)
      }
    }
    else {
      let name = await getGuild(msg.guild.id)
      const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Commands for ${name}`)
        .addField("Default Commands:", "\u200B")
        .addFields(
          {name: "addCommand", value: "Add a command to the bot. After your original message, put the code for your command in a code block and make sure to mention the bot. \n \n Example usage: \`pb addCommand <command name> '<command help>'\`"},
          {name: "cancelCommand", value: "Cancels the creation of a command if one is currently in progress. \n \n Example usage: \`pb cancelCommand\`"},
          {name: "resetCommand", value: "Resets a command, deleting the code. \n \n Example usage: \`pb resetCommand <new command name> '<new command help>'\`"},
          {name: "deleteCommand", value: "Deletes a command, erasing it from the bot. \n \n Example usage: \`pb deleteCommand <command name>\`"},
          {name: "commands/help", value: "Gives you a help command, with either 1 or all commands. \n \n Example usage: \`pb commands <optional: command name> / pb help <optional: command name>\`"},
          {name: "addCommandFromServer", value: "Adds a command from a server of your choice. \n \n Example usage: \`pb addCommandFromServer <server id> <old command name> <new command name> '<new command help>'\`"},
          {name: "addCommandFromRepo *BETA*", value: "Gets a command from a Github repo fo your choice. \n \n NOTE: This command is in beta and may not work. If your command is split into multiple files, addCommandFromRepo may not fetch the whole command. \n \n Example usage: \`pb addCommandFromRepo <repo owner>/<repo name> <file name> <function name in repo> <command name> '<command help>'\`"}
        )
        .addField("User Generated Commands:", "\u200B")
      if (Object.keys(userGenerated[msg.guild.id]).length !== 0){
        Object.keys(userGenerated[msg.guild.id]).forEach((i, index) => {
          try {
            exampleEmbed.addField(i, Object.values(userGenerated[msg.guild.id])[index].help[0] || "none", true)
          }
          catch {
            exampleEmbed.addField(i, "none", true)
          }
        })
      }
      else {
        exampleEmbed.addField("There are no user generated commands in this server currently", "Use pb addCommand to add a command.")
      }
      msg.channel.send(exampleEmbed)
    }
	}
	else if (args[0] === "addCommandFromRepo") {
		if (waiting) return msg.channel.send("You must complete one command before starting another one.")
		if (!((args[1]) && (args[2]) && (args[3]) && (args[4]))) return msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
    if (Object.keys(userGenerated[msg.guild.id]).includes(args[4])) return msg.channel.send("This command already exists.")
    try {
      let options = {
        owner: args[1].split("/")[0],
        repo: args[1].split("/")[1],
        branch: 'master' 
      };
      var gc = new GithubContent(options);
      gc.file(args[2], function(err, file) {
        if (err) return msg.channel.send(err);
        let contents = file.contents.toString("utf-8")
        try {
          let sender = getFunc(contents, args[3])
          if (typeof sender === 'string') {
            return msg.channel.send(sender)
          }
          let chosenCode = contents.slice(sender[0], sender[1])
          console.log(typeof sender)
          if (!removeProcess(chosenCode)) return msg.channel.send("Please do not use process. variables in the code.")
          if (!removeClient(chosenCode)) return msg.channel.send("Please do not use msg.client in the code.")
          try {
            let add = parse(contents, args[3])
            chosenCode = add + chosenCode
            let split = chosenCode.split("\n")
            console.log(chunkString(chosenCode, 2000))
            for (i of chunkString(chosenCode, 2000)) {
              msg.channel.send("\`\`\`js\n\u200B" + i + "\`\`\`")
            }
            let mcode = `
              const Discord = require("discord.js") 
              const bot = new Discord.Client()

              bot.login("${process.env.TOKEN}")

              ${chosenCode}

              bot.on("ready", async () => {
                try {
                  let mmsg = await bot.channels.fetch(parsed.msg.cid)
                  let b = await mmsg.messages.fetch(parsed.msg.mid)
                  ${args[3]}(b)
                }
                catch(e){
                  console.log(e)
                }
              })`
            userGenerated[msg.guild.id][args[4]] = {
              status: "Alive",
              createdBy: [args[1].split("/")[0], msg.author.username],
              runner: chosenCode,
              printer: code,
              help: getFromBetween.get(msg.content, "'", "'") || "none"
            }
            return msg.channel.send(`Command ${args[4]} added!`)
            db.collection("commands").doc(`${msg.guild.id}`).set(classToPlain(userGenerated[msg.guild.id]))
          }
          catch (e) {
            console.error(e)
            return sendErr(e, msg)
          }
        }
        catch (e) {
          console.log(e)
          return msg.channel.send("The repo provided had invalid code.")
        }
      });
    }
    catch(e){
      msg.channel.send("Invalid command call. Use pb commands or pb help to learn more about how to use the commands.")
      return sendErr(e, msg)
    }
	}
	else if (userGenerated[msg.guild.id]) {
		Object.keys(userGenerated[msg.guild.id]).forEach(command => {
      if (Object.keys(userGenerated[msg.guild.id]).includes(args[0])) {
        if (args[0] === command) {
          console.log(command)
          if (userGenerated[msg.guild.id][command].status === "Bugged") {
            return msg.channel.send("This command is bugged at the moment.")
          }
          try {
            let data = null
            db.collection("runners").doc(`${msg.guild.id}`).get().then(doc => {
              if (doc.exists) {
                data = doc.data()
              }
            })
            if (data) {
              let len = Object.values(data).length
              let obj = {}
              let thing = JSON.stringify({
                "runner": userGenerated[msg.guild.id][command].runner,
                "msg": {
                  mid: msg.id,
                  cid: msg.channel.id
                }
              })
              obj[`runner${len}`] = thing
              console.log("sent")
              return db.collection("runners").doc(`${msg.guild.id}`).set(classToPlain({ ...data, ...obj }))
            }
            else {
              let se = {
                "runner0": JSON.stringify({
                  "runner": userGenerated[msg.guild.id][command].runner,
                  "msg": {
                    mid: msg.id,
                    cid: msg.channel.id
                  }
                })
              }
              return db.collection("runners").doc(`${msg.guild.id}`).set(classToPlain(se))
            }
          }
          catch (e) {
            console.error(e)
            userGenerated[msg.guild.id][command].status = "Bugged"
            db.collection("commands").doc(`${msg.guild.id}`).set(classToPlain(userGenerated[msg.guild.id]))
            return sendErr(e, msg)
          }
        }
      }
      else {
        return msg.channel.send(`Command ${args[0]} not found.`)
      }
		})
	}
})