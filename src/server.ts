#!/usr/bin/env node
import fs = require('fs');
import http = require('http');
import path = require('path');
import child_process = require('child_process');
import readline = require('readline');
import debug = require('debug');
import com = require('commander');
import express = require('express');
import helmet = require('helmet');
import bodyParser = require('body-parser');
import formidable = require('formidable');
import SocketIO = require('socket.io');
import favicon = require('serve-favicon');
import cookieParser = require('cookie-parser');
import lessMiddleware = require('less-middleware');
import logger = require('morgan');
import {asynchronous} from "./util";

const pkg: {version: string; name: string} = require("../package.json");

com
  .version(pkg.version)
  .usage("[options]")
  .option('-p, --port [8080]', '****', 8080)
  //.arguments('<*>')
  .parse(process.argv);

const {args} = com;

const app = express();
const server = http.createServer(app);
const io = SocketIO(server)
const log = debug(`${pkg.name}:server`);
const spawn = child_process.spawn; // http://www.axlight.com/mt/sundayhacking/2014/03/nodejschild-processexecexecfilespawn.html

app.use(helmet());
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');

const index_router = express.Router();
index_router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

const api_router = express.Router();
api_router.post("/push", (req, res)=>{
  const form = new formidable.IncomingForm();
  form.encoding = "utf-8";
  form.uploadDir = "./uploads"
  form.parse(req, (err, fields, files)=>{
    console.log(err, fields, files);
    const oldPath = './' + files.file["_writeStream"]["path"];
    const newPath = './uploads/' + Date.now() + "_" + files.file.name;
    fs.rename(oldPath, newPath, (err)=>{
      if(err){ throw err; }
    });
  });
  res.statusCode = 204;
  res.send();
});

app.use('/', index_router);
app.use('/api', api_router);

app.use((req, res, next)=>{
  const err = new Error('Not Found');
  err["status"] = 404;
  next(err);
});

app.use((err, req, res, next)=>{
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

io.on('connection', (socket)=>{
  console.log("connection", socket.client.id)
  socket.on('echo', (data)=>{ socket.emit("echo", data); });
  socket.on('event', console.info.bind(console, "event") );
  socket.on('disconnect', console.info.bind(console, "disconnect") );

  const stdlog = spawn(
    "/bin/bash", ["-c", `watch -n 1 date 2>&1 | tee log.txt`],
    { stdio: ["ignore", "pipe", "ignore"], detached: true });
  stdlog.on('exit', console.log.bind(console, "Child exited with code"));
  const rl = readline.createInterface({ terminal: false, input: stdlog.stdout, output: process.stdout });
  rl.on("line", socket.emit.bind(socket, "line"));
  const onend = (err)=>{
    process.removeListener('uncaughtException', onerror);
    process.kill(-stdlog.pid); // http://azimi.me/2014/12/31/kill-child_process-node-js.html
  };
  process.on('uncaughtException', onend);
  socket.on('disconnect', onend);
});


server.on('error', (error)=>{
  if (error["syscall"] !== 'listen') { throw error; }
  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  switch (error["code"]) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', ()=>{
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  log('Listening on ' + bind);
});

const port: string = com["port"];
app.set('port', port);
server.listen(port);