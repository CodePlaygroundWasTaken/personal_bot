const firebase = require("firebase");
var Queue = require('firebase-queue');
// const {NodeVM} = require('vm2');
const Discord = require("discord.js")
const {NodeVM, VMScript} = require('vm2');
const fs = require('fs');
const child_process = require('child_process');
const { classToPlain } = require("class-transformer")
//var amqp = require('amqplib/callback_api');
const bot = new Discord.Client()

bot.login(process.env.TOKEN)

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

let created = []

db.collection("runners").onSnapshot(querySnapshot => {
  querySnapshot.forEach(doc => {
    if (!created.includes(doc.ref.path)) {
      db.collection("runners").doc(doc.ref.path.split("/")[1]).onSnapshot(doc => {
        if (doc.data()) {
          let data = doc.data()
          db.collection("runners").doc(doc.id).set(classToPlain({}))
          for (i of Object.values(data)) {
            let parsed = JSON.parse(i)
            let scriptOutput = ""
            var workerProcess = child_process.spawn('node', ['code.js', parsed.runner, JSON.stringify(parsed)])

            let timeout = setTimeout(() => {
              workerProcess.kill("SIGINT")
            }, 10000) 

            workerProcess.stdout.on('data', function (data) {
              console.log('stdout: ' + data);
              data=data.toString();
              scriptOutput+=data; 
            });

            workerProcess.stderr.on("data", function(data){
              console.log('stderr: ' + data);
              data=data.toString();
              scriptOutput+=data;
            })

            workerProcess.on('close', async function (code) {
              clearTimeout(timeout)
              console.log("========Result========")
              console.log(scriptOutput)
              let mmsg = await bot.channels.fetch(parsed.msg.cid)
              const exampleEmbed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle(`Result:`)
                .setDescription(`\`========Result======== \n${scriptOutput}\``)
              mmsg.send(exampleEmbed)
            });
          }     
        }
      })
    }
  })
});

