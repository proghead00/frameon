var AppProcess = (function () {
// const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation; // or 'BodyPix'

//   const segmenterConfig = {
//   runtime: 'mediapipe', // or 'tfjs'
//   modelType: 'landscape' // or 'landscape'
//   };

//   segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);

  var peers_connection_ids = [];
  var peers_connection = [];
  var remote_vid_stream = [];
  var remote_aud_stream = [];
  let local_div;
  let canvas;
  var audio;
  var icecandidate;
  var net;
  var isAudioMute = true;
  var rtp_aud_senders = [];
  var video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  var video_st = video_states.None;
  var videoCamTrack;
  var rtp_vid_senders = [];
  var serverProcess;
  async function _init(SDP_function, my_connid) {
    serverProcess = SDP_function;
    my_connection_id = my_connid;
    eventProcess();
    local_div = document.getElementById("LocalVideoPlayer");
    canvas = document.getElementById("canvas")
    canvasCtx = canvas.getContext("2d")
    net = await bodyPix.load()

    // const outputStride = 16;
    // const segmentationThreshold = 0.5;


  }
  function eventProcess() {
    $("#miceMuteUnmute").on("click", async function () {
      if (!audio) {
        await loadAudio();
      }
      if (!audio) {
        alert("Audio permission has not been granted");
        return;
      }

      if (isAudioMute) {
        audio.enabled = true;
        $(this).html("<span class='material-icons' >mic</span>");
        updateMediaSenders(audio, rtp_aud_senders);
      } else {
        audio.enabled = false;
        $(this).html("<span class='material-icons' >mic_off</span>");
        removeMediaSenders(rtp_aud_senders);
      }
      isAudioMute = !isAudioMute;
    });
    $("#videoCamOnOff").on("click", async function () {
      if (video_st == video_states.Camera) {
        console.log(video_st)
        await videoProcess(video_states.None);
      } else {
        console.log(video_st)
        await videoProcess(video_states.Camera);
      }
    });
    $("#ScreenShareOnOf").on("click", async function () {
      if (video_st == video_states.ScreenShare) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.ScreenShare);
      }
    });
  }
  async function loadAudio() {
    try {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      audio = astream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
  }
  function connection_status(connection) {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } else {
      return false;
    }
  }
  async function updateMediaSenders(track, rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) {
          rtp_senders[con_id].replaceTrack(track);
        } else {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
        }
      }
    }
  }
  function removeMediaSenders(rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
        peers_connection[con_id].removeTrack(rtp_senders[con_id]);
        rtp_senders[con_id] = null;
        console.log("removeMediaSenders");
      }
    }
  }
  function removeVideoStream(rtp_vid_senders) {
    if (videoCamTrack) {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }


  function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.drawImage(results.segmentationMask, 0, 0,
                        canvas.width, canvas.height);
  
    // Only overwrite existing pixels.
    canvasCtx.globalCompositeOperation = 'source-out';
    canvasCtx.fillStyle = '#000000';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  
    // Only overwrite missing pixels.
    canvasCtx.globalCompositeOperation = 'destination-atop';
    canvasCtx.drawImage(
        results.image, 0, 0, canvas.width, canvas.height);
  
    canvasCtx.restore();
  }


  async function videoProcess(newVideoState) {
    if (newVideoState == video_states.None) {
      // console.log(newVideoState)
      $("#videoCamOnOff").html(
        "<span class='material-icons' >videocam_off</span>"
      );

      $("#ScreenShareOnOf").html(
        '<span class="material-icons">present_to_all</span><div>Screen share</div>'
      );
      video_st = newVideoState;

      removeVideoStream(rtp_vid_senders);
      return;
    }
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html("<span class='material-icons' >videocam</span>");
    }
    try {
      var vstream = null;
      if (newVideoState == video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });

        if (vstream && vstream.getVideoTracks().length > 0) {
          videoCamTrack = vstream.getVideoTracks()[0];
          console.log(videoCamTrack)
          
          if (videoCamTrack) {
            console.log(local_div);
            local_div.srcObject = new MediaStream([videoCamTrack]);
            // const canvasCtx = canvas.getContext("2d")
            const selfieSegmentation = new SelfieSegmentation({locateFile: (file) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
            }});
            selfieSegmentation.setOptions({
              modelSelection: 1,
            });
            selfieSegmentation.onResults(onResults);
            
            const camera = new Camera(local_div, {
              onFrame: async () => {
                await selfieSegmentation.send({image: local_div});
              },
              width: 1920,
              height: 1080
            });
  
            camera.start()
            // setInterval(async () => {
            //   net = await bodyPix.load({
            //     architecture: 'MobileNetV1',
            //     outputStride: 16,
            //     multiplier: 0.75,
            //     quantBytes: 2
            //   });
            //   const segmentation = await net.segmentPerson(local_div, {
            //     flipHorizontal: false,
            //     internalResolution: 'medium',
            //     segmentationThreshold: 0.5
            //   });
    
            //   const foregroundColor = { r: 0, g: 0, b: 0, a: 255 };
            //   const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
            //   const backgroundDarkeningMask = bodyPix.toMask(segmentation, foregroundColor, backgroundColor, false); 
            //   // const coloredPartImage = bodyPix.toMask(segmentation);
            //   compositeFrame(backgroundDarkeningMask);  
            // }, 10)
            // // const opacity = 0.7;
            // // const flipHorizontal = false;
            // // const maskBlurAmount = 0; 
            // // bodyPix.drawMask(
            // //   canvas, local_div, backgroundDarkeningMask, opacity, maskBlurAmount,
            // // flipHorizontal);    
            
            console.log(local_div);
            console.log(segmentation)
            updateMediaSenders(videoCamTrack, rtp_vid_senders);
          }
        }

        // local_div.srcObject = vstream
        // const net = await bodyPix.load()
        // console.log(vstream)
        // const personSegmentation = await net.segmentPerson(vstream.video);

        // console.log(personSegmentation)

      } else if (newVideoState == video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
        vstream.oninactive = (e) => {
          removeVideoStream(rtp_vid_senders);
          $("#ScreenShareOnOf").html(
            '<span class="material-icons">present_to_all</span><div>Screen share</div>'
          );
        };
      }
      
    } catch (e) {
      console.log(e);
      return;
    }
    video_st = newVideoState;
    if (newVideoState == video_states.Camera) {
      new Camera(local_div).stop()
      console.log("off")
      $("#videoCamOnOff").html('<span class="material-icons">videocam</span>');
      $("#ScreenShareOnOf").html(
        '<span class="material-icons">present_to_all</span><div>Screen share</div>'
      );
    } else if (newVideoState == video_states.ScreenShare) {
      $("#ScreenShareOnOf").html(
        '<span class="material-icons text-success">present_to_all</span><div class="text-success">Stop sharing</div>'
      );
      $("#videoCamOnOff").html(
        '<span class="material-icons" >videocam_off</span>'
      );
    }
  }
  var iceConfiguration = {
    iceServers: [
      {
        urls: ["turn:13.250.13.83:3478?transport=udp"],
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6",
      },
      //   {
      //     urls: "stun:stun.l.google.com:19302",
      //   },
      //   {
      //     urls: "stun:stun1.l.google.com:19302",
      //   },
    ],
  };
  
  async function setConnection(connid) {
    var connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connid);
    };
    connection.onicecandidate = function (event) {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({ icecandidate: event.candidate }),
          connid
        );
      }
    };
    connection.ontrack = function (event) {
      if (!remote_vid_stream[connid]) {
        remote_vid_stream[connid] = new MediaStream();
      }
      if (!remote_aud_stream[connid]) {
        remote_aud_stream[connid] = new MediaStream();
      }

      if (event.track.kind == "video") {
        remote_vid_stream[connid]
          .getVideoTracks()
          .forEach((t) => remote_vid_stream[connid].removeTrack(t));
        remote_vid_stream[connid].addTrack(event.track);
        var remoteVideoPlayer = document.getElementById("v_" + connid);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remote_vid_stream[connid];
        remoteVideoPlayer.load();
      } else if (event.track.kind == "audio") {
        remote_aud_stream[connid]
          .getAudioTracks()
          .forEach((t) => remote_aud_stream[connid].removeTrack(t));
        remote_aud_stream[connid].addTrack(event.track);
        var remoteAudioPlayer = document.getElementById("a_" + connid);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remote_aud_stream[connid];
        remoteAudioPlayer.load();
      }
    };

    peers_connection_ids[connid] = connid;
    peers_connection[connid] = connection;

    if (
      video_st == video_states.Camera ||
      video_st == video_states.ScreenShare
    ) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
      }
    }
    return connection;
  }
  async function setOffer(connid) {
    var connection = peers_connection[connid];
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    serverProcess(
      JSON.stringify({
        offer: connection.localDescription,
      }),
      connid
    );
  }
  async function SDPProcess(message, from_connid) {
    message = JSON.parse(message);
    if (message.answer) {
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
    } else if (message.offer) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);
      }
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      var answer = await peers_connection[from_connid].createAnswer();
      await peers_connection[from_connid].setLocalDescription(answer);
      serverProcess(
        JSON.stringify({
          answer: answer,
        }),
        from_connid
      );
    } else if (message.icecandidate) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);
      }
      try {
        await peers_connection[from_connid].addIceCandidate(
          message,
          icecandidate
        );
      } catch (e) {
        console.log(e);
      }
    }
  }

  async function closeConnection(connid) {
    peers_connection_ids[connid] = null;
    if (peers_connection[connid]) {
      peers_connection[connid].close();
      peers_connection[connid] = null;
    }

    if (remote_aud_stream[connid]) {
      remove_aud_stream[connid].getTrack().forEach((t) => {
        if (t.stop) {
          t.stop();
        }
        remote_aud_stream[connid] = null;
      });
    }
    if (remote_vid_stream[connid]) {
      remove_vid_stream[connid].getTrack().forEach((t) => {
        if (t.stop) {
          t.stop();
        }
        remote_aud_stream[connid] = null;
      });
    }
  }

  return {
    setNewConnection: async function (connid) {
      await setConnection(connid);
    },
    init: function (SDP_function, my_connid) {
      _init(SDP_function, my_connid);
    },
    processClientFunc: async function (data, from_connid) {
      await SDPProcess(data, from_connid);
    },
    closeConnectionCall: async function (connId) {
      await closeConnection(connId);
    },
  };
})();
var MyApp = (function () {
  var socket = null;
  var user_id = "";
  var meeting_id = "";
  function init(uid, mid) {
    user_id = uid;
    meeting_id = mid;
    $("#meetingContainer").show();
    $("#me h2").text(user_id + "(Me)");
    document.title = user_id;
    event_process_for_signaling_server();
    eventHandling();
  }

  function event_process_for_signaling_server() {
    socket = io.connect();

    var SDP_function = function (data, to_connid) {
      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid,
      });
    };
    socket.on("connect", () => {
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
        if (user_id != "" && meeting_id != "") {
          socket.emit("userconnect", {
            displayName: user_id,
            meetingid: meeting_id,
          });
        }
      }
    });

    socket.on("inform_others_about_disconnected_user", function (data) {
      $("#" + data.connId).remove();
      $(".participant-count").text(data.uNumber);
      $("#participant_" + data.connId + " ").remove();
      AppProcess.closeConnectionCall(data.connId);
    });

    socket.on("inform_others_about_me", function (data) {
      addUser(data.other_user_id, data.connId, data.userNumber);
      AppProcess.setNewConnection(data.connId);
    });

    socket.on("showFileMessage", function (data) {
      const time = new Date();
      const lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      const attachFileAreaForOther =
        document.querySelector(".show-attach-file");

      attachFileAreaForOther.innerHTML +=
        "<div class='left-align' style ='display:flex; align-items:center;'> <img src='public/Assets/images/person22.png' style='height:40px; width:40px;' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" +
        data.username +
        "</div>:<div><a style='color: red;' href=' " +
        data.filePath +
        " ' download>" +
        data.fileName +
        "</a></div></div><br/>";
    });

    socket.on("inform_me_about_other_user", function (other_users) {
      var userNumber = other_users.length;
      var userNumb = userNumber + 1;

      if (other_users) {
        for (var i = 0; i < other_users.length; i++) {
          addUser(
            other_users[i].user_id,
            other_users[i].connectionId,
            userNumb
          );
          AppProcess.setNewConnection(other_users[i].connectionId);
        }
      }
    });
    socket.on("SDPProcess", async function (data) {
      await AppProcess.processClientFunc(data.message, data.from_connid);
    });

    socket.on("showChatMessage", function (data) {
      const time = new Date();
      const lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      const div = $("<div>").html(
        "<span class='font-weight-bold mr-3' style='color:black'>" +
          data.from +
          "</span>" +
          lTime +
          "</br>" +
          data.message
      );
      $("#messages").append(div);
    });
  }

  function eventHandling() {
    $("#btnsend").on("click", function () {
      const msgData = $("#msgbox").val();
      socket.emit("sendMessage", $("#msgbox").val());
      const time = new Date();
      const lTime = time.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      const div = $("<div>").html(
        "<span class='font-weight-bold mr-3' style='color:black'>" +
          user_id +
          "</span>" +
          lTime +
          "</br>" +
          msgData
      );
      $("#messages").append(div);
      $("#msgbox").val("");
    });

    var url = window.location.href;
    $(".meeting_url").text(url);

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }

  function addUser(other_user_id, connId, userNum) {
    var newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connId).addClass("other");
    newDivId.find("h2").text(other_user_id);
    newDivId.find("video").attr("id", "v_" + connId);
    newDivId.find("audio").attr("id", "a_" + connId);
    newDivId.show();
    $("#divUsers").append(newDivId);
    $(".in-call-wrap-up").append(
      ' <div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' +
        connId +
        '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/person.png" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name ml-2"> ' +
        other_user_id +
        '</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons"> </span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons"> <img src="https://img.icons8.com/emoji/48/000000/green-circle-emoji.png" style="height:17px;"/></span> </div> </div> </div>'
    );

    $(".participant-count").text(userNum);
  }

  $(document).on("click", ".people-heading", function () {
    $(".chat-show-wrap").hide(300);
    $(".in-call-wrap-up").show(300);
    $(this).addClass("active");
    $(".chat-heading").removeClass("active");
  });

  $(document).on("click", ".chat-heading", function () {
    $(".chat-show-wrap").show(300);
    $(".in-call-wrap-up").hide(300);
    $(this).addClass("active");
    $(".people-heading").removeClass("active");
  });

  $(document).on("click", ".meeting-heading-cross", function () {
    $(".g-right-details-wrap").hide(300);
  });

  $(document).on("click", ".top-left-participant-wrap ", function () {
    $(".people-heading").addClass("active");
    $(".chat-heading").removeClass("active");
    $(".g-right-details-wrap").show(300);
    $(".in-call-wrap-up").show(300);
    $(".in-call-wrap-up").hide(300);
  });

  $(document).on("click", ".top-left-chat-wrap ", function () {
    $(".people-heading").removeClass("active");
    $(".chat-heading").addClass("active");
    $(".g-right-details-wrap").show(300);
    $(".in-call-wrap-up").hide(300);
    $(".in-call-wrap-up").show(300);
  });

  $(document).on("click", ".end-call-wrap ", function () {
    $(".top-box-show")
      .css({
        display: "block",
      })
      .html(
        ' <div class ="top-box align-vertical-middle profile-dialogue-show"> <h3 class="mt-3" style="text-align:center; font-size: 32px; color: #1A2C22;"> Leave meeting </h3> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-2"> Leave </button></a> <button class="call-cancel-action btn btn-secondary"> Cancel </button> </div> </div>'
      );
  });

  $(document).mouseup(function (e) {
    var container = new Array();
    container.push($(".top-box-show"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length === 0) {
        $(value).empty();
      }
    });
  });

  $(document).mouseup(function (e) {
    var container = new Array();
    container.push($(".g-details"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length === 0) {
        $(value).hide(300);
      }
    });
  });

  $(document).on("click", ".call-cancel-action", function () {
    $(".top-box-show").html("");
  });

  $(document).on("click", ".copy_info", function () {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(".meeting_url").text()).select();
    document.execCommand("copy");
    $temp.remove();
    $(".link-conf").show();
    setTimeout(function () {
      $(".link-conf").hide();
    }, 3000);
  });

  $(document).on("click", ".meeting-details-button", function () {
    $(".g-details").slideDown(300);
  });

  $(document).on("click", ".g-details-heading-attachment", function () {
    $(".g-details-heading-show").hide();
    $(".g-details-heading-show-attachment").show();
    $(this).addClass("active");
    $(".g-details-heading-detail").removeClass("active");
  });

  $(document).on("click", ".g-details-heading-detail", function () {
    $(".g-details-heading-show").show();
    $(".g-details-heading-show-attachment").hide();
    $(this).addClass("active");
    $(".g-details-heading-attachment").removeClass("active");
  });

  const base_url = window.location.origin;

  $(document).on("change", ".custom-file-input", function () {
    const fileName = $(this).val().split("\\").pop();
    $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
  });

  $(document).on("click", ".share-attach", function (e) {
    e.preventDefault();
    const att_img = $("#customFile").prop("files")[0];
    const formData = new FormData();
    formData.append("zipfile", att_img);
    formData.append("meeting_id", meeting_id);
    formData.append("username", user_id);
    $.ajax({
      url: base_url + "/attachimg",
      type: "POST",
      data: formData,
      processData: false,
      contentType: false,

      success: function (response) {
        console.log(response);
      },

      error: function () {
        console.log("error");
      },
    });

    const attachFileArea = document.querySelector(".show-attach-file");
    const attachFileName = $("#customFile").val().split("\\").pop();

    const attachFilePath =
      "public/attachment/" + meeting_id + "/" + attachFileName;

    attachFileArea.innerHTML +=
      "<div class='left-align' style ='display:flex; align-items:center;'> <img src='public/Assets/images/person22.png' style='height:40px; width:40px;' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" +
      user_id +
      "</div>:<div><a style='color: red;' href=' " +
      attachFilePath +
      " ' download>" +
      attachFileName +
      "</a></div></div><br/>";

    $("label.custom-file-label").text("");

    socket.emit("fileTransferToOther", {
      username: user_id,
      meetingid: meeting_id,
      filePath: attachFilePath,
      fileName: attachFileName,
    });
  });

  $(document).on("click", ".option-icon", function () {
    $(".recording-show").toggle(300);
  });

  $(document).on("click", ".start-record", function () {
    $(this)
      .removeClass()
      .addClass("stop-record btn-danger text-dark")
      .text("Stop recording");

    startRecording();
  });

  $(document).on("click", ".stop-record", function () {
    $(this)
      .removeClass()
      .addClass("start-record btn-dark text-danger")
      .text("Start recording");

    mediaRecorder.stop();
  });

  var mediaRecorder;
  var chunks = [];

  async function captureScreen(
    mediaConstraints = {
      video: true,
    }
  ) {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(
      mediaConstraints
    );

    return screenStream;
  }

  async function captureAudio(
    mediaConstraints = {
      video: false,
      audio: true,
    }
  ) {
    const audioStream = await navigator.mediaDevices.getUserMedia(
      mediaConstraints
    );

    return audioStream;
  }

  async function startRecording() {
    const screenStream = await captureScreen();
    const audioStream = await captureAudio();

    const stream = new MediaStream([
      ...screenStream.getTracks(),
      ...audioStream.getTracks(),
    ]);

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.onstop = function (e) {
      var clipName = prompt("Enter a name for the recording");
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, {
        type: "video/webm",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = clipName + ".webm";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    };

    mediaRecorder.ondataavailable = function (e) {
      chunks.push(e.data);
    };
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
