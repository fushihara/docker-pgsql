process.on('unhandledRejection',(reason, promise) => {
  console.error(reason);
});
const config     = require("./config.json");
const express    = require("express")();
const {CronJob}  = require("cron");
const dateformat = require("dateformat");
const { Client } = require('pg')
const request    = require("request");
const fs         = require("fs");
async function main(){
  initTextFile();
  let db = await initDatabase();
  await dbInsertLog(db,`アプリ起動`);
  await initWebServer(db);
  await tickTimer(db);
  new CronJob(`00 */1 * * * *`, async () => {
    await tickTimer(db);
  }, null, true);
}
main();
function initTextFile(){
  if(require("os").platform() == "win32"){
    console.log(`ファイル作成 スキップ`);
    return;
  }
  console.log(`ファイル作成 開始 ${config.test_file.length}件`);
  config.test_file.forEach((f)=>{
    if(fs.existsSync(f.filepath)){
      console.log(`ファイル作成 存在したのでスキップ ${f.filepath}`);
      return;
    }
    try{
      fs.writeFileSync(f.filepath,dateformat(new Date(),"yyyy-mm-dd HH:MM:ss"));
      console.log(`ファイル作成 ${f.filepath}`);
    }catch(e){
      console.log(`ファイル作成失敗 ${f.filepath}`);
    }
  });
}
function dbInsertLog(db,message){
  console.log(dateformat(new Date(),"yyyy-mm-dd HH:MM:ss") + " " + message);
  return db.query(`insert into test_table(memo) values ( $1 )`,[message]);
}
function initDatabase(){
  const client = new Client({host: config.pg_host,port: config.pg_port,user: config.pg_user,password: config.pg_pass,database:config.pg_table});
  return client.connect().then((i)=>{
    let promiseList = [];
    promiseList.push(client.query(`CREATE TABLE IF NOT EXISTS test_table(id serial,memo text,ts timestamp with time zone NOT NULL DEFAULT now())`));
    return Promise.all(promiseList).then(i=>client);
  });
}
function initWebServer(db){
  express.get("/", async function(req, res){
    let testFileDetails = config.test_file.map((f)=>{
      let time = "";
      if(fs.existsSync(f.filepath) == false){
        time = "ファイル無し";
      }else{
        time = fs.readFileSync(f.filepath);
      }
      return `<tr><td>${f.filepath}</td><td>${f.title}</td><td>${time}</td></tr>`;
    }).join("\n");
    await dbInsertLog(db,`GETリクエスト受信`);
    let datas = (await db.query(`select id,memo,ts from test_table order by id desc limit 100`)).rows.map((i)=>{return `<li>${i.id} ${i.ts} ${i.memo}</li>`;}).join("\n");
    res.send(`
<!DOCTYPE html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<style>
 *{word-break: break-all;box-sizing: border-box;}
</style>
<h2>ファイル永続化</h2>
<table>
<tr><td>ファイルパス</td><td>説明文</td><td>作成時</td></tr>
${testFileDetails}
</table>
<h2>アクセスログ</h2>
<ul>
${datas}
</ul>
    `);
  });
  return new Promise((ok,ng)=>{
    var server = express.listen(20006, function(){
        ok();
    });
  });
}
function tickTimer(db){
  const postSlack = (message)=>{
    return new Promise((ok,ng)=>{
      if(config.slack_token==""){
        ok("SlackにTick しようとしたがTokenがカラなのでスキップ");
        return;
      }
      let form = {
              token: config.slack_token,
              channel: config.slack_channel,
              username: 'Dockerテスト - postgresql',
              text: message
      };
      let callback = (error,response,body)=>{
        if(error){
          ng(new Error(error));
        }else{
          ok("SlackにTick");
        }
      };
      request.post('https://slack.com/api/chat.postMessage', { form: form }, callback );
    });
  }
  return Promise.resolve()
     .then(i=>db.query(`select id,memo,ts from test_table order by id desc limit 1`,[]))
     .then(i=>{
       let postMessage = `tick ${dateformat(new Date(),"yyyy-mm-dd HH:MM:ss")} / ${i.rows[0].id} ${i.rows[0].ts} ${i.rows[0].memo}`;
       return postSlack(postMessage);
     }).then(i=>{
         dbInsertLog(db,i);
     });
}
