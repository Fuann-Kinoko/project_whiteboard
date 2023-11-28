var io = io().connect('http://localhost:8080')
var username

// 监听服务器
io.on('loginSuccess', ({inviteCode}) => {
    localStorage.setItem('inviteCode', inviteCode);
    localStorage.setItem('username', username);
    window.location.href = "./paint.html";
})
io.on('loginFailed', () => {
    alert('邀请码无效');
})
io.on('createSuccess', ({newInviteCode}) => {
    localStorage.setItem('inviteCode', newInviteCode);
    localStorage.setItem('username', username);
    console.log('New invite code:', newInviteCode);
    io.emit('createSession', { newInviteCode });
    window.location.href = "./paint.html";
})
io.on('createFailed', () => {
    createSession();
})

function login() {
    username = document.getElementById('username').value;
    if(!username){
        alert("用户名不能为空！")
    }else{
        const inviteCode = document.getElementById('inviteCode').value;
        console.log(`${inviteCode}验证`)
        io.emit('verify', { inviteCode });
    }
}

function createSession() {
    username = document.getElementById('username').value;
    if(!username){
        alert("用户名不能为空！")
    }else{
        const newInviteCode = generateInviteCode(6);
        io.emit('existedCode', { newInviteCode });
    }
}

function generateInviteCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let inviteCode = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        inviteCode += characters.charAt(randomIndex);
    }
    return inviteCode;
}