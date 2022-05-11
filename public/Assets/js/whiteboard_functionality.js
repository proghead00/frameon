const socket = io("https://frameon.herokuapp.com/");

socket.on("connect", () => {
  console.log(`Connected with id: ${socket.id}`);
});

socket.on("disconnected", () => {
  var userSocket = socket.id;
  socket.disconnect();
  console.log(`Disconnected: ${userSocket}`);
});

socket.on("clear", () => {
  clearWhiteBoard();
});

const joinWhiteboardRoomBtn = document.getElementById("room-submit");
const joinRoomInput = document.getElementById("room-input");
joinRoomInput.value = window.location.search.split("=")[1];
const exitRoomBtn = document.getElementById("exit-room");
const nickName = document.getElementById("nick-name");
const modalShowFormBtn = document.getElementById("modal-connect-button");
const clearBoardBtn = document.getElementById("clear-button");

// $(exitRoomBtn).hide();

if (exitRoomBtn) {
  exitRoomBtn.addEventListener("click", () => {
    socket.emit("disconnection");
    $(modalShowFormBtn).show();
    $(exitRoomBtn).hide();
    window.close();
  });
}

if (clearBoardBtn) {
  clearBoardBtn.addEventListener("click", () => {
    socket.emit("clearBoard", joinRoomInput.value);
    clearWhiteBoard();
  });
}

if (joinWhiteboardRoomBtn) {
  joinWhiteboardRoomBtn.addEventListener("click", () => {
    socket.connect();

    const room = joinRoomInput.value;
    const nickname = nickName.value;

    if (room === "" || nickname === "") return;

    socket.emit("join-wb-room", room, nickname, (message) => {
      setJoinMessageToUser(message);
      $(modalShowFormBtn).hide();
      $(exitRoomBtn).show();
    });
  });
}

var colors = document.getElementsByClassName("color");

for (var i = 0; i < colors.length; i++) {
  colors[i].addEventListener("click", onColorUpdate, false);
}

function onColorUpdate(e) {
  current.color = e.target.className.split(" ")[1];
}

function setJoinMessageToUser(msg) {
  const elem = document.createElement("h2");
  elem.textContent = msg;
  document.getElementById("welcome-room").append(elem);
}

var canvas = document.getElementsByClassName("whiteboard")[0];
var context = canvas.getContext("2d");

var current = {
  color: "black",
};

var drawing = false;

canvas.addEventListener("mousedown", onMouseDown, false);
canvas.addEventListener("mouseup", onMouseUp, false);
canvas.addEventListener("mouseout", onMouseUp, false);
canvas.addEventListener("mousemove", throttle(onMouseMove, 10), false);

socket.on("drawing", (data) => {
  onDrawingEvent(data);
});

window.addEventListener("resize", onResize, false);
onResize();

function clearWhiteBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawLine(x0, y0, x1, y1, color, emit) {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);

  context.strokeStyle = color;
  context.lineWidth = 2;

  context.stroke();
  context.closePath();

  if (!emit) return;
  var w = canvas.width;
  var h = canvas.height;

  socket.emit(
    "userDrawing",
    {
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color,
    },
    joinRoomInput.value
  );
}

function onMouseDown(e) {
  drawing = true;

  current.x = e.clientX;
  current.y = e.clientY;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;
  drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);

  current.x = e.clientX;
  current.y = e.clientY;
}

function throttle(callback, delay) {
  var previousCall = new Date().getTime();
  return function () {
    var time = new Date().getTime();
    if (time - previousCall >= delay) {
      previousCall = time;
      callback.apply(null, arguments);
    }
  };
}

function onMouseMove(e) {
  if (!drawing) {
    return;
  }

  drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);

  current.x = e.clientX;
  current.y = e.clientY;
}

function onDrawingEvent(data) {
  var w = canvas.width;
  var h = canvas.height;

  drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
}

function onResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
