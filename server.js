'use strict';

require('app-module-path').addPath(__dirname);

const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const logger = require('src/logger');
const uws = require('uws');
const uuid = require('node-uuid');

let port = process.env.port || 8888;

let httpsOptions = {
    key: fs.readFileSync('ssl/server-key.pem'),
    cert: fs.readFileSync('ssl/server-cert.pem')
};

let server = https.createServer(httpsOptions, (req, res) => {
    res.writeHead(404);
    res.end();
});

let io = socketIO.listen(server);
io.engine.ws = new uws.Server({
    noServer: true,
    perMessageDeflate: false
});

const p2pEvents = [
    'offer',
    'answer',
    'icecandidate'
];

io.sockets.on('connection', (socket) => {
    let senderId = socket.id;

    // handle all of the basic signaling needs for webrtc connection,
    // these messages are strictly from one peer to another,
    // these are kept as different events to keep things simple on the client
    p2pEvents.forEach((event) => {
        socket.on(event, (msg) => {
            let {receiverId, data} = msg;
            socket.broadcast.to(receiverId).emit(event, {
                senderId,
                data
            });
        });
    });

    // handle joining of a room
    socket.on('join', (msg) => {
        let room = msg.data;
        console.log(socket.rooms);
        Object.keys(socket.rooms).forEach((room) => {
            if (room !== senderId) {
                socket.leave(room);
            }
        });
        socket.join(room, (err) => {
            if (!err) {
                console.log(socket.rooms);
                socket.broadcast.to(room).emit('client-join', senderId);
            }
        });
    });

    // handle the creation of a room
    socket.on('create', () => {
        let room = uuid.v4();
        Object.keys(socket.rooms).forEach((room) => {
            if (room !== senderId) {
                socket.leave(room);
            }
        });
        socket.join(room, (err) => {
            if (!err) {
                socket.broadcast.to(senderId).emit('roomCreated', room);
            }
        });
    });
});

server.listen(port, () => {
    logger.info(`Signalling server is listening on port ${port}`);
});
