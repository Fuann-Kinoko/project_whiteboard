let express = require("express");
const { cursorTo } = require("readline");

let app = express();
app.use(express.static("public"));

let httpServer = require("http").createServer(app);
let PORT = process.env.PORT || 9090;
httpServer.listen(PORT, () => console.log(`Server started on port ${PORT}`));

let io = require("socket.io")(httpServer);

let connections = []
// store all the paintActions
let paintActions = []


const sessionData = {}; // 用于存储画布信息的对象

io.on('connection', (socket) => {
    // init
    connections.push(socket);
    console.log(`${socket.id} has connected`);
    socket.emit('onconnect', { id: socket.id })
    let code, curSession;

    // login and create
    socket.on('verify', (data) => {
        // console.log(`${socket.id}验证${data.inviteCode}`);
        if (sessionData[data.inviteCode]) {
            connections.forEach((con) => {
                if (con.id == socket.id) {
                    con.emit('loginSuccess', { inviteCode: data.inviteCode });
                }
            });
            console.log(sessionData[data.inviteCode].users);
        } else {
            connections.forEach((con) => {
                if (con.id == socket.id) {
                    con.emit('loginFailed', {});
                }
            });
        }
    });
    socket.on('existedCode', (data) => {
        if (sessionData.hasOwnProperty(data.newInviteCode)) {
            console.log(`Canvas exists for invite code: ${data.newInviteCode}`);
            connections.forEach((con) => {
                if (con.id == socket.id) {
                    con.emit('createFailed', {});
                }
            });
        } else {
            console.log(`Canvas does not exist for invite code: ${data.newInviteCode}`);
            sessionData[data.newInviteCode] = {
                users: [],
                paintActions: []
            };
            connections.forEach((con) => {
                if (con.id == socket.id) {
                    con.emit('createSuccess', { newInviteCode: data.newInviteCode });
                }
            });
        }
    });
    socket.on('onSession', (data) => {
        console.log(`${socket.id}在${data.receivedInviteCode}`)

        sessionData[data.receivedInviteCode].users.push(socket.id);
        code = data.receivedInviteCode;
        curSession = sessionData[code];

        // redo the paint actions happened before the connection
        for (let i = 0; i < curSession.paintActions.length; i++) {
            // console.log("paintActions[",i,"]is: ", curSession.paintActions[i])
            curSession.paintActions[i](socket, socket)
        }
        socket.emit('onpickColor', { color: "#000", id: socket.id }) // reset the color

        console.log(sessionData[data.receivedInviteCode].users)
    });

    // transmit events
    socket.on('down', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('ondown', { x: data.x, y: data.y, id: socket.id });
            }
        });
        // !! push a lazy function (which contains the emittion)
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('ondown', { x: data.x, y: data.y, id: socket_i.id }) })
    });

    socket.on('drawLine', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('ondrawLine', { x: data.x, y: data.y, id: socket.id });
            }
        });
        // push in a lazy function (which contains the emittion) to be called
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('ondrawLine', { x: data.x, y: data.y, id: socket_i.id }) })
    });

    socket.on('drawRect', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('ondrawRect', { x: data.x, y: data.y, width: data.width, height: data.height, id: socket.id });
            }
        });
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('ondrawRect', { x: data.x, y: data.y, width: data.width, height: data.height, id: socket_i.id }) })
    });

    socket.on('drawCirc', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('ondrawCirc', { centerX: data.centerX, centerY: data.centerY, radius: data.radius, id: socket.id });
            }
        });
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('ondrawCirc', { centerX: data.centerX, centerY: data.centerY, radius: data.radius, id: socket_i.id }) })
    });

    socket.on('writeText', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('onwriteText', { txt: data.txt, x: data.x, y: data.y, id: socket.id });
            }
        });
        // TODO: add paintActions for writeText
    });

    socket.on('eraser', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('oneraser', { x: data.x, y: data.y });
            }
        });
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('oneraser', { x: data.x, y: data.y }) })
    });

    // reset does not save an action, instead it deletes all actions
    socket.on('reset', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('onreset');
            }
        });
        curSession.paintActions = []
    });

    socket.on('pickColor', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('onpickColor', { color: data.cur_color, id: socket.id });
            }
        });
        curSession.paintActions.push((con_i, socket_i) => { con_i.emit('onpickColor', { color: data.cur_color, id: socket_i.id }) })
    });

    socket.on('boardcastName', (data) => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('onname', { x: data.x, y: data.y, username: data.username});
            }
        });
    });

    socket.on('finishDraw', () => {
        connections.forEach((con) => {
            if (con.id !== socket.id && curSession.users.includes(con.id)) {
                con.emit('onfinish', {});
            }
        });
    });

    socket.on('disconnect', (reason) => {
        console.log(`${socket.id} is disconnected`);
        connections = connections.filter((con) => con.id !== socket.id);
    })
});