import {
  Detection,
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import React from "react";
import Button from "@mui/material/Button";

const ALPHA = 0.5;
const MARGIN = 120;
const THRESHOLD = 5;

function DetectFace() {
  const faceDetectoRef = React.useRef<FaceDetector>();
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const localStreamRef = React.useRef<MediaStream>(new MediaStream());
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const lastX = React.useRef(0);
  const lastY = React.useRef(0);
  const lastWidth = React.useRef(0);
  const lastHeight = React.useRef(0);
  const isFirstFrame = React.useRef(true);
  const lastVideoTime = React.useRef(-1);
  const requestAnimationFrameRef = React.useRef<number>();
  const [detectedFace, setDetectedFace] = React.useState(false);

  /**
   * draw face detected area on canvas
   *
   * @param detections detected face information
   * @returns
   */
  function displayVideoDetections(detections: Detection[]) {
    const video = localVideoRef.current;
    if (!video) {
      console.error("video element is null");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("canvas element is null");
      return;
    }

    // draw face detected area on canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("canvas context is null");
      return;
    }

    detections.forEach((detection) => {
      const boundingBox = detection.boundingBox;
      if (!boundingBox) {
        return;
      }

      let x = boundingBox.originX - MARGIN;
      let y = boundingBox.originY - MARGIN;
      let width = boundingBox.width + 2 * MARGIN;
      let height = boundingBox.height + 2 * MARGIN;

      if (!isFirstFrame.current) {
        let changeX = Math.abs(x - lastX.current);
        let changeY = Math.abs(y - lastY.current);
        let changeWidth = Math.abs(width - lastWidth.current);
        let changeHeight = Math.abs(height - lastHeight.current);

        if (
          changeX >= THRESHOLD ||
          changeY >= THRESHOLD ||
          changeWidth >= THRESHOLD ||
          changeHeight >= THRESHOLD
        ) {
          x = lastX.current + ALPHA * (x - lastX.current);
          y = lastY.current + ALPHA * (y - lastY.current);
          width = lastWidth.current + ALPHA * (width - lastWidth.current);
          height = lastHeight.current + ALPHA * (height - lastHeight.current);
        } else {
          x = lastX.current;
          y = lastY.current;
          width = lastWidth.current;
          height = lastHeight.current;
        }
      } else {
        isFirstFrame.current = false;
      }

      // update last values
      lastX.current = x;
      lastY.current = y;
      lastWidth.current = width;
      lastHeight.current = height;

      // adjust video boundary
      x = Math.max(0, Math.min(video.videoWidth - width, x));
      y = Math.max(0, Math.min(video.videoHeight - height, y));

      // draw
      ctx.drawImage(
        video,
        x,
        y,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.restore();
    });
  }

  /**
   * run face detection using mediapipe face detector
   *
   * @returns
   */
  const runningFaceDetect = () => {
    const video = localVideoRef.current;
    if (!video) {
      return;
    }

    let startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      const detections = faceDetectoRef.current?.detectForVideo(
        localVideoRef.current,
        startTimeMs
      ).detections;

      if (detections && detections.length > 0) {
        // detected face
        // draw face detected area on canvas
        displayVideoDetections(detections);
        setDetectedFace(true);
      } else {
        // no detected face
        // hide canvas
        setDetectedFace(false);
      }
    }

    // request next frame
    requestAnimationFrameRef.current =
      window.requestAnimationFrame(runningFaceDetect);
  };

  /**
   * setup mediapipe face detector
   *
   * @returns
   */
  const setupFaceDetector = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
    });

    faceDetectoRef.current = faceDetector;
  };

  /**
   * cleanup mediapipe face detector
   *
   * @returns
   */
  const cleanupFaceDetector = () => {
    faceDetectoRef.current?.close();
    faceDetectoRef.current = undefined;
  };

  /**
   * start face detection
   *
   * @returns
   */
  const start = async () => {
    // setup face detector
    await setupFaceDetector();

    // start requestAnimationFrame for face detection
    runningFaceDetect();

    // reset state
    setDetectedFace(false);
  };

  /**
   * stop face detection
   *
   * @returns
   */
  const stop = () => {
    // stop requestAnimationFrame
    if (requestAnimationFrameRef.current) {
      window.cancelAnimationFrame(requestAnimationFrameRef.current);
    }

    // stop face detection
    cleanupFaceDetector();

    // clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // reset state
    setDetectedFace(false);
  };

  /**
   * button clicked event handler
   */
  const handleButtonClicked = () => {
    setIsRunning(!isRunning);
  };

  /**
   * useEffect for isRunning state
   */
  React.useEffect(() => {
    if (isRunning) {
      start();
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  /**
   * get video stream from camera and set to local video element
   */
  React.useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        localStreamRef.current.addTrack(stream.getVideoTracks()[0]);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      })
      .catch((error) => {
        console.error("error: ", error);
      });
  }, []);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <h1>Detect Face</h1>
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "480px", height: "auto" }}
      />

      <canvas
        ref={canvasRef}
        hidden={!detectedFace}
        style={{
          position: "absolute",
          bottom: "0",
          right: "0",
          borderRadius: "50%",
          overflow: "hidden",
          width: "120px",
          height: "120px",
          boxShadow: "0 0 10px 5px rgba(0, 0, 0, 0.5)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <Button
          variant="contained"
          color={isRunning ? "secondary" : "primary"}
          onClick={handleButtonClicked}
          style={{ width: "100px", fontWeight: "bold" }}
        >
          {isRunning ? "Stop" : "Start"}
        </Button>
      </div>
    </div>
  );
}

export default DetectFace;
