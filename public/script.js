// structure in the class:
// - iBoard
//      - canvas
//      - ctx
//      - pressed, x, y, width, radius, rect ...
class iBoard {
    constructor(cav, id) {
        this.canvas = cav;
        this.canvas.id = id;
        this.canvas.className = 'boardCanvas';
        this.ctx = this.canvas.getContext("2d");
        this.canvas.width = 0.9 * window.innerWidth;
        this.canvas.height = 0.9 * window.innerHeight;
        this.pressed = false;
        this.drawMode = 'pencil';
        this.eraserMode = false;
        this.x = null; this.y = null;
        this.width = null; this.height = null;
        this.radius = null;
        this.rect = this.canvas.getBoundingClientRect();
        this.color = null;
    }
}


var io = io().connect('http://localhost:8080')


/*
====================
init webpage buttons
====================
*/
let getButton = btt => document.getElementById(btt);
let pencilButton = getButton('pencilButton');
let rectangleButton = getButton('rectangleButton');
let circleButton = getButton('circleButton');
let textButton = getButton('textButton');
let eraserButton = getButton('eraserButton');
let resetButton = getButton('resetButton');


/*
===========
init board
===========
*/

const username = localStorage.getItem('username');
const receivedInviteCode = localStorage.getItem('inviteCode');
document.getElementById('nameDisplay').innerText = "用户: " + username;
document.getElementById('inviteCodeDisplay').innerText = "邀请码: " + receivedInviteCode;

io.emit('onSession', { receivedInviteCode });

// local board settings
let localBoard = new iBoard(document.getElementById('board'), 'board');
let localCTX = localBoard.ctx;
let animationBoard = new iBoard(document.getElementById('animation'), 'animation');
let animationCTX = animationBoard.ctx;
let nameBoard = new iBoard(document.getElementById('name'), 'name');
let nameCTX = nameBoard.ctx;
nameCTX.font = '15px "Microsoft YaHei", sans-serif';

// init reserved for remote canvas
// one board has only one 2D ctx and one canvas
let remoteCtxMap = new Map();
var remoteCtxCnt = 0;

/*
===========================
addClickEventListner for buttons
===========================
*/
document.addEventListener('DOMContentLoaded', function () {
    buttonLst = [pencilButton, rectangleButton, circleButton, textButton, eraserButton];
    let buttons = document.querySelectorAll('.button');
    buttons.forEach(function (button) {
        if (buttonLst.includes(button)) {
            button.addEventListener('click', function () {
                buttons.forEach(function (btn) {
                    btn.classList.remove('selected');
                });
                this.classList.add('selected');
            });
        }
    });
});


function addDrawModeChangeEvent(btt, method) {
    btt.addEventListener('click', method);
}
function addRegularDrawmodeChangeEvent(btt, bttMode) {
    addDrawModeChangeEvent(
        btt,
        () => {
            localBoard.drawMode = bttMode;
            console.log('drawMode change to', bttMode);
        }
    );
}

addRegularDrawmodeChangeEvent(pencilButton, 'pencil');
addRegularDrawmodeChangeEvent(rectangleButton, 'rectangle');
addRegularDrawmodeChangeEvent(circleButton, 'circle');
addRegularDrawmodeChangeEvent(textButton, 'text');
addRegularDrawmodeChangeEvent(eraserButton, 'eraser');
addDrawModeChangeEvent(
    resetButton,
    function () {
        console.log("reset");
        reset();
        io.emit('reset', { receivedInviteCode });
    }
);

// copy invite code
function code() {
    navigator.clipboard.writeText(receivedInviteCode)
        .then(() => {
            alert('邀请码已复制到剪贴板');
        })
        .catch(err => { });
}

// quit
function quit() {
    window.location.href = "./index.html";
}

/*
=========================
add handlers for io event
=========================
*/
let handleByCavnasID = (id, handleContent) => {
    let remoteCTX = remoteCtxMap.get(id);
    if (remoteCTX) {
        // console.log("remote context FOUND", id)
        handleContent(remoteCTX);
    } else {
        let remoteBoard = new iBoard(
            document.createElement('canvas'),
            id
        );
        let stackDiv = document.getElementById('stack');
        stackDiv.appendChild(remoteBoard.canvas);
        remoteCTX = remoteBoard.canvas.getContext("2d");
        remoteCtxMap.set(id, remoteCTX)
        // console.log("remote context ADDED", id)
        handleContent(remoteCTX)
    }
}

io.on('onconnect', ({ id }) => {
    // it is intended not to modify the canvas id of localBoard
    // canvas `id` will specifically redo the paintActions happen before connection
    // on the contrast, canvas `board` is the main canvas and displays current paintActions
    // localBoard.canvas.id = id;
})
io.on('ondown', ({ x, y, id }) => {
    handleByCavnasID(id, (ctx) => { ctx.moveTo(x, y); })
})
io.on('ondrawLine', ({ x, y, id }) => {
    handleByCavnasID(id, (ctx) => { drawLine(ctx, x, y); })
})
io.on('ondrawRect', ({ x, y, width, height, id }) => {
    handleByCavnasID(id, (ctx) => { drawRectangle(ctx, x, y, width, height); })
})
io.on('ondrawCirc', ({ centerX, centerY, radius, id }) => {
    handleByCavnasID(id, (ctx) => { drawCircle(ctx, centerX, centerY, radius); })
})
io.on('onwriteText', ({ txt, x, y, id }) => {
    handleByCavnasID(id, (ctx) => { writeText(ctx, txt, x, y); })
})
io.on('oneraser', ({ x, y }) => erase(x, y))
io.on('onreset', () => reset())
io.on('onpickColor', ({ color, id }) => {
    handleByCavnasID(id, (ctx) => { pickColor(ctx, color); })
})
io.on('onname', ({ x, y, username }) => { nameRect(x, y, username); })
io.on('onfinish', () => { nameCTX.clearRect(0, 0, localBoard.canvas.width, localBoard.canvas.height); })


function ctxclear(ctx) {
    ctx.clearRect(0, 0, localBoard.canvas.width, localBoard.canvas.height);
}

function drawLine(ctx, x, y) {
    ctx.lineTo(x, y);
    ctx.stroke();
}

function drawRectangle(ctx, x, y, width, height) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.rect(x, y, width, height);
    ctx.stroke();
    console.log("Rect drawed in context", ctx)
}
function rectangleAnimation(x, y, width, height) {
    animationCTX.beginPath();
    animationCTX.lineWidth = 2;
    animationCTX.rect(x, y, width, height);
    ctxclear(animationCTX);
    animationCTX.strokeStyle = localCTX.color;
    animationCTX.stroke();
}

function drawCircle(ctx, centerX, centerY, radius) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    console.log("Circle drawed in context", ctx)
}
function circleAnimation(centerX, centerY, radius) {
    animationCTX.beginPath();
    animationCTX.lineWidth = 2;
    animationCTX.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctxclear(animationCTX);
    animationCTX.strokeStyle = localCTX.color;
    animationCTX.stroke();
}

function writeText(ctx, txt, x, y) {
    // 在其他人的画布上字体显示的一样
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = 'italic bold 20px Arial, sans-serif';
    ctx.fillText(txt, x - 4, y - 4);
    console.log("Text Written in context", ctx)
}
function ctxerase(ctx, x, y) {
    ctx.globalCompositeOperation = 'destination-out'; // 设置混合模式为destination-out，即删除模式
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; // 恢复混合模式
}
function erase(x, y) {
    ctxerase(localCTX, x, y);
    for (let iCTX of remoteCtxMap.values()) {
        ctxerase(iCTX, x, y);
    }
}
function eraseAnimation(x, y) {
    animationCTX.beginPath();
    animationCTX.arc(x, y, 30, 0, Math.PI * 2);
    animationCTX.clearRect(0, 0, localBoard.canvas.width, localBoard.canvas.height);
    animationCTX.stroke();
}

function ctxreset(ctx) {
    ctxclear(ctx);
    ctx.beginPath();  // clear previous path
    console.log("Reset in context", ctx);
}
function reset() {
    ctxreset(localCTX);
    ctxreset(animationCTX);
    for (let iCTX of remoteCtxMap.values()) {
        ctxreset(iCTX);
    }
}
function pickColor(ctx, color) {
    ctx.beginPath()
    ctx.strokeStyle = color;
    ctx.color = color;
    console.log("Color", color, "Picked in context", ctx)
}
function nameRect(x, y, name) {
    const rectx = x + 25;
    const recty = y - 30;
    nameCTX.clearRect(0, 0, localBoard.canvas.width, localBoard.canvas.height);
    const textWidth = nameCTX.measureText(name).width;
    // console.log(textWidth)
    const textHeight = 25;
    nameCTX.fillStyle = 'rgb(224, 154, 32)';
    nameCTX.fillRect(rectx, recty - textHeight / 4, textWidth * 2, textHeight);
    nameCTX.fillStyle = 'white';
    nameCTX.fillText(name, rectx + textWidth / 2, recty + textHeight / 2);
}

/*
=======================
add mouse event emitter
=======================
*/
window.onmousedown = (e) => {
    if (document.elementFromPoint(e.clientX, e.clientY).className != 'boardCanvas') return;
    localBoard.x = e.clientX - localBoard.rect.left;
    localBoard.y = e.clientY - localBoard.rect.top;
    let x = localBoard.x; let y = localBoard.y;

    localCTX.moveTo(x, y);
    io.emit('down', { x, y });
    // io.emit('broadcastName', { x, y, username })
    localBoard.pressed = true;

    switch (localBoard.drawMode) {
        case 'eraser': {
            localBoard.eraserMode = true;
            erase(localCTX, x, y);
            io.emit('eraser', { x, y });
            break;
        }
    }
}
window.onmouseup = (e) => {
    localBoard.pressed = false;
    localBoard.eraserMode = false;
    ctxclear(nameCTX);
    switch (localBoard.drawMode) {
        case 'pencil': {
            io.emit('finishDraw', {});
            break;
        }
        case 'eraser': {
            ctxclear(animationCTX);
            io.emit('finishDraw', {});
            break;
        }
        case 'rectangle': {
            localBoard.width = e.clientX - localBoard.rect.left - localBoard.x;
            localBoard.height = e.clientY - localBoard.rect.top - localBoard.y;
            let x = localBoard.x; let y = localBoard.y;
            let width = localBoard.width; let height = localBoard.height;

            // 检查是否发生在画布里
            if (x >= 0 && x <= localBoard.canvas.width && y >= 0 && y <= localBoard.canvas.height) {
                drawRectangle(localCTX, x, y, width, height);
                ctxclear(animationCTX);
                io.emit('drawRect', { x, y, width, height });
                io.emit('finishDraw', {});
            }
            break;
        }
        case 'circle': {
            let x = localBoard.x; let y = localBoard.y;

            // 检查是否发生在画布里
            if (x >= 0 && x <= localBoard.canvas.width && y >= 0 && y <= localBoard.canvas.height) {
                let centerX = (e.clientX - localBoard.rect.left + x) / 2;
                let centerY = (e.clientY - localBoard.rect.top + y) / 2;
                localBoard.radius = Math.sqrt(Math.pow(e.clientX - localBoard.rect.left - centerX, 2) + Math.pow(e.clientY - localBoard.rect.top - centerY, 2));
                let radius = localBoard.radius;
                drawCircle(localCTX, centerX, centerY, radius);
                ctxclear(animationCTX);
                io.emit('drawCirc', { centerX, centerY, radius });
                io.emit('finishDraw', {});
            }
            break;
        }
    }
}
window.onmousemove = (e) => {
    if (document.elementFromPoint(e.clientX, e.clientY).className != 'boardCanvas') return;
    switch (localBoard.drawMode) {
        case 'pencil': {
            localBoard.x = e.clientX - localBoard.rect.left;
            localBoard.y = e.clientY - localBoard.rect.top;
            if (localBoard.pressed != true) break;
            let x = localBoard.x; let y = localBoard.y;
            drawLine(localCTX, x, y);
            io.emit('drawLine', { x, y, receivedInviteCode })
            if (localBoard.pressed) {
                io.emit('broadcastName', { x, y, username })
            }
            break;
        }
        case 'eraser': {
            localBoard.x = e.clientX - localBoard.rect.left;
            localBoard.y = e.clientY - localBoard.rect.top;
            if (localBoard.eraserMode != true) break;
            let x = localBoard.x; let y = localBoard.y;
            erase(x, y);
            eraseAnimation(x,y);
            io.emit('eraser', { x, y });
            if (localBoard.pressed) {
                io.emit('broadcastName', { x, y, username })
            }
            break;
        }
        case 'rectangle': {
            if (localBoard.pressed != true) break;
            localBoard.width = e.clientX - localBoard.rect.left - localBoard.x;
            localBoard.height = e.clientY - localBoard.rect.top - localBoard.y;
            let x = localBoard.x; let y = localBoard.y;
            let width = localBoard.width; let height = localBoard.height;

            // 检查是否发生在画布里
            if (x >= 0 && x <= localBoard.canvas.width && y >= 0 && y <= localBoard.canvas.height) {
                rectangleAnimation(x, y, width, height);
                if (localBoard.pressed) {
                    io.emit('broadcastName', { x, y, username })
                }
            }
            break;
        }
        case 'circle': {
            if (localBoard.pressed != true) break;
            let x = localBoard.x; let y = localBoard.y;
            let centerX = (e.clientX - localBoard.rect.left + x) / 2;
            let centerY = (e.clientY - localBoard.rect.top + y) / 2;
            localBoard.radius = Math.sqrt(Math.pow(e.clientX - localBoard.rect.left - centerX, 2) + Math.pow(e.clientY - localBoard.rect.top - centerY, 2));
            let radius = localBoard.radius;
            // 检查是否发生在画布里
            if (x >= 0 && x <= localBoard.canvas.width && y >= 0 && y <= localBoard.canvas.height) {
                circleAnimation(centerX, centerY, radius);
                if (localBoard.pressed) {
                    io.emit('broadcastName', { x, y, username })
                }
            }
            break;
        }
    }
};

/*
===============================================
handle tool that requires mouseClick: text tool
===============================================
*/

// 没有按回车，重新单击，文本框消失
const textTool = {
    hasInput: false,
    inputElement: null, // 保存当前输入框的引用

    addInput(x, y) {
        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'fixed';
        input.style.left = (x - 4) + 'px';
        input.style.top = (y - 4) + 'px';

        input.onkeydown = textTool.handleEnter;

        document.body.appendChild(input);
        input.focus();

        textTool.inputElement = input; // 保存输入框的引用
        textTool.hasInput = true;
    },

    handleEnter(e) {
        const keyCode = e.keyCode;
        if (keyCode === 13) {
            textTool.drawText(this.value, parseInt(this.style.left, 10), parseInt(this.style.top, 10));
            document.body.removeChild(this);
            textTool.hasInput = false;
        }
    },

    drawText(txt, x, y) {
        localCTX.textBaseline = 'top';
        localCTX.textAlign = 'left';
        localCTX.font = 'italic bold 20px Arial, sans-serif';
        localCTX.fillText(txt, x - 4, y - 4);
        io.emit('writeText', { txt, x, y });
    },

    hideInput() { // 隐藏当前输入框
        if (textTool.inputElement) {
            document.body.removeChild(textTool.inputElement);
            textTool.inputElement = null;
            textTool.hasInput = false;
        }
    },
};

// 换成 window.onclick，且 输入文本框的点击事件只发生在画布里
window.onclick = function (e) {
    if (localBoard.drawMode != 'text') return;
    if (document.elementFromPoint(e.clientX, e.clientY).className != 'boardCanvas') return;
    // 获取点击坐标相对于画布的坐标
    const rect = localBoard.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 检查是否在画布内点击
    if (x >= 0 && x <= localBoard.canvas.width && y >= 0 && y <= localBoard.canvas.height) {
        if (textTool.hasInput) {
            textTool.hideInput(); // 如果已有输入框，隐藏它
        } else {
            textTool.addInput(x, y); // 否则添加输入框
        }
    } else {
        textTool.hideInput(); // 点击画布外，隐藏输入框
    }
}