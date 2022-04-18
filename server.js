const express = require("express");
const { fstat } = require("fs");
//const { join } = require('path')
const path = require("path");
const app = express();
const PORT = 3000;
const server = app.listen(process.env.PORT || 3000, function () {
    console.log("server running on ", PORT);
});

const fs = require("fs");
const fileUpload = require("express-fileupload");

const io = require("socket.io")(server, {
  allowEIO3: true, // false by default
});
app.use(express.static(path.join(__dirname, "")));

/* this line has a problem */
var userConnections = [];
io.on("connection", (socket) => {
  console.log(`socket id is ${socket.id}`);
  socket.on("userconnect", (data) => {
    console.log("userconnect", data.displayName, data.meetingid);

    var other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );

    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });

    var userCount = userConnections.length;
    console.log(userCount);

    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_others_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userCount,
      });
    });
    socket.emit("inform_me_about_other_user", other_users);
  });
  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connid).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });

  socket.on("sendMessage", (msg) => {
    console.log(msg);
    const mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      const meetingid = mUser.meeting_id;
      const from = mUser.user_id;
      const list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showChatMessage", {
          from: from,
          message: msg,
        });
      });
    }
  });

  socket.on("fileTransferToOther", (msg) => {
    console.log(msg);
    const mUser = userConnections.find((p) => p.connectionId == socket.id);
    if (mUser) {
      const meetingid = mUser.meeting_id;
      const from = mUser.user_id;
      const list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        socket.to(v.connectionId).emit("showFileMessage", {
          username: msg.username,
          meetingid: msg.meetingid,
          filePath: msg.filePath,
          fileName: msg.fileName,
        });
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    const disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      const meetingid = disUser.meeting_id;

      // userConnections.filter((p) => p.connectionId == socket.id);
      // console.log(disUser)
      // const newList = userConnections.filter((p) => p.connectionId != disUser.connectionId)
      // //const list = userConnections.filter((p) => p.meeting_id == meetingid);
      // const list = newList.filter((p) => p.meeting_id == meetingid);

      // console.log(newList);
      userConnections.splice(userConnections.indexOf(disUser), 1);
      const list = userConnections.filter((p) => p.meeting_id == meetingid);

      console.log(userConnections);
      list.forEach((v) => {
        const userNumberAfUserLeave = userConnections.length;
        console.log("No. of user after leave ", userNumberAfUserLeave);

        socket
          .to(v.connectionId)
          .emit("inform_others_about_disconnected_user", {
            connId: socket.id,
            uNumber: userNumberAfUserLeave,
          });
      });
    }
  });
});

app.use(fileUpload());
app.post("/attachimg", function (req, res) {
  const data = req.body;
  const imageFile = req.files.zipfile;
  console.log(imageFile);

  const dir = "public/attachment/" + data.meeting_id + "/";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  imageFile.mv(
    "public/attachment/" + data.meeting_id + "/" + imageFile.name,
    function (error) {
      if (error) {
        console.log("Couldn't upload the img. ERROR:", error);
      } else {
        console.log("Img succesfully uploaded");
      }
    }
  );
});
