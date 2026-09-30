import { CardInfo } from "@/components/CardInfo";
import { base64toBlob, getEnvVariables } from "@/helpers";
import { useCredentialStore, useStastisticsStore } from "@/hooks";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useBiometricStore } from "@/hooks/useBiometric";
import { usePersonStore } from "@/hooks/usePersonStore";
import { useSweetAlert } from "@/hooks/useSweetAlert";
import { Box, Grid, Stack } from "@mui/material";
import * as faceapi from "face-api.js";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const TINY_OPTIONS = {
  inputSize: 320,
  scoreThreshold: 0.5,
};

const TINY_OPTIONS_PHOTO = {
  inputSize: 608,
  scoreThreshold: 0.6,
};

const DEV_MODE = getEnvVariables().DEV_MODE === "true";

let faceMatcher: any = null;

interface GroupedDescriptors {
  [key: string]: any[];
}

const text = (
  <>
    Por favor, retire su <b>carnet de identidad</b> del soporte.
    <br />
    Quítese el sombrero, lentes y barbijo para el reconocimiento facial y
    presione en <b>continuar.</b>
  </>
);

const html = (attempts: number) => {
  return `
    <div style="
      display: flex;
      justify-content: center;
      align-items: center;
      width: 80px;
      height: 80px;
      background-color: #008698;
      color: white;
      border-radius: 50%;
      font-size: 2.5rem;
      margin: 0 auto;">
      ${attempts + 1}
    </div>
    <p style="margin-top: 1rem;">Por favor, inténtalo de nuevo.</p>
  `;
};

const getCameras = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === "videoinput");
};

const getIntegratedCamera = async () => {
  const cameras = await getCameras();

  if (!cameras || cameras.length === 0) return null;

  const integrated = cameras.find(c =>
    c.label?.toLowerCase().includes("camera")
  );

  if (integrated) return integrated;

  const logitech = cameras.find(c =>
    c.label?.toLowerCase().includes("logitech")
  );

  if (logitech) return logitech;

  return cameras[0];
};

export const FaceRecognition = memo(
  forwardRef((_, ref) => {
    useImperativeHandle(ref, () => ({
      onRemoveCam: () => cleanup(),
      onPlaying: () => getLocalUserVideo(),
      action: () => scanPhoto(),
    }));

    let intervalVideo: NodeJS.Timeout;
    let img: any;

    const [imageSrc, setImageSrc] = useState("");
    const [attempts, setAttempts] = useState(0);
    const [fetchedImage, setFetchedImage] = useState<HTMLIFrameElement | null>(
      null
    );
    const MAX_ATTEMPTS = 3;

    const {
      image,
      changeRecognizedByFacialRecognition,
      ocr,
      changeIdentifyUser,
      changeStep,
      changeLoadingGlobal,
      identityCard,
      savePhoto,
    } = useCredentialStore();
    const { ocrState, leftText, rightText } = useStastisticsStore();
    const { authMethodRegistration } = useAuthStore();
    const { person, getPerson } = usePersonStore();
    const { fingerprints, getFingerprints } = useBiometricStore();
    const { showAlert } = useSweetAlert();

    const videoRef: any = useRef();
    const canvasVideoRef: any = useRef();
    const imageRef: any = useRef();

    /* ====== CONFIGURACIÓN DE LOS PESOS DEL MODELO DE FACEAPI ======= */
    const loadModels = async () => {
      const uri = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.ssdMobilenetv1.loadFromUri(uri),
        faceapi.nets.faceLandmark68Net.loadFromUri(uri),
        faceapi.nets.faceRecognitionNet.loadFromUri(uri),
      ]);
    };
    /* =============================================================== */

    /* =========== CONFIGURACIÓN DE LA CÁMARA DE VIDEO  ============== */
    const setAutomaticFocus = async (stream: MediaStream) => {
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities();
      if (
        capabilities.focusMode &&
        capabilities.focusMode.includes("continuous")
      ) {
        const constraints: any = {
          focusMode: "continuous",
        };
        await track.applyConstraints(constraints);
      } else {
        console.log(
          "El enfoque automatico no es compatible con este dispositivo."
        );
      }
    };

    const getLocalUserVideo = async () => {
      try {
        const cam = await getIntegratedCamera();
        if (!cam) throw new Error("Cámara integrada no encontrada");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: cam.deviceId }
          },
          audio: false,
        });

        await setAutomaticFocus(stream);
        videoRef.current.srcObject = stream;
      } catch (error) {
        console.error("Error cámara rostro:", error);
      }
    };
    /* =============================================================== */

    /* ============= DETECCIÓN DEL ROSTRO EN EL VIDEO ================ */
    const groupDescriptorsByName = (faceDescriptors: any) =>
      faceDescriptors.reduce(
        (
          groupedDescriptors: GroupedDescriptors,
          { descriptor }: { descriptor: any },
          index: number
        ) => {
          const name = `persona ${index}`;
          groupedDescriptors[name] = [
            ...(groupedDescriptors[name] || []),
            descriptor,
          ];
          return groupedDescriptors;
        },
        {}
      );

    const isFaceDetectionModelLoad = () =>
      !!faceapi.nets.tinyFaceDetector.params;

    const scanVideo = async () => {
      const options = new faceapi.TinyFaceDetectorOptions(TINY_OPTIONS);
      if (imageRef.current) {
        if (faceapi.isMediaElement(imageRef.current)) {
          console.log("El input es un elemento HTML válido.");
        } else {
          console.log("El input no es un elemento válido para face-api.js.");
        }
      }
      const detections = await faceapi
        .detectAllFaces(imageRef.current ?? videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const groupedDescriptors = groupDescriptorsByName(detections);
      const labeledDescriptors = Object.keys(groupedDescriptors).map(
        (name) =>
          new faceapi.LabeledFaceDescriptors(name, groupedDescriptors[name])
      );

      if (labeledDescriptors.length > 0) {
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
        if (videoRef.current != null) {
          const dims = faceapi.matchDimensions(
            canvasVideoRef.current,
            videoRef.current,
            true
          );
          const resizedDetections = faceapi.resizeResults(detections, dims);
          resizedDetections.forEach(({ detection, descriptor }) => {
            let label = faceMatcher.findBestMatch(descriptor).toString();
            label = label.substring(0, 9);
            const boxStyle = {
              label: `${label}`,
              lineWidth: 2,
              boxColor: "green",
              drawLabel: true,
            };
            new faceapi.draw.DrawBox(detection.box, boxStyle).draw(
              canvasVideoRef.current
            );
          });
          faceapi.draw.drawFaceLandmarks(
            canvasVideoRef.current,
            resizedDetections
          );
        }
      } else {
        if (canvasVideoRef.current != null) {
          const ctx = canvasVideoRef.current.getContext("2d", {
            willReadFrequently: true,
          });
          ctx.clearRect(
            0,
            0,
            canvasVideoRef.current.width,
            canvasVideoRef.current.height
          );
        }
      }
    };

    const scanFace = async () => {
      // video
      if (!isFaceDetectionModelLoad()) return;

      intervalVideo = setInterval(async () => {
        scanVideo();
      }, 60);
    };
    /* =============================================================== */

    /* =========== RECONOCIMIENTO DE ROSTRO EN EL WEBCAM ============= */
    const sendStatistics = async (faceState: boolean) => {
      const body = {
        identity_card: identityCard,
        left_text: leftText,
        right_text: rightText,
        ocr_state: ocrState,
        facial_recognition: faceState,
        person_id: parseInt(person.id, 10),
        recognized_text_captured: "",
      };
      authMethodRegistration(body);
    };

    const handleNoDetections = () => {
      changeLoadingGlobal(false);
      sendStatistics(false);
      showAlert({
        title: "Vuelve a intentarlo",
        message:
          "Por favor, mire de frente a la cámara, sin lentes ni sombrero.",
        icon: "warning",
      });
    };

    const handleUnrecognizedFace = () => {
      const currentAttempts = attempts + 1;
      setAttempts(currentAttempts);
      console.log("OCR: ", ocr);
      console.log("================================");
      console.log("NO RECONOCE EL ROSTRO");
      console.log("================================");

      if (currentAttempts > MAX_ATTEMPTS) {
        if (fingerprints && fingerprints.length > 0) {
          showAlert({
            title: "Persona no identificada",
            message: "¿Quiere intentarlo con su huella?",
            icon: "warning",
            cancelText: "Atras",
            onConfirm: () => {
              operative({
                step: "biometricRecognition",
                identifyUser: false,
              });
              cleanup();
            },
            onCancel: () => {
              console.log("cancelado");
            },
            allowOutsideClick: true,
          });
        } else {
          showAlert({
            title: "Persona no identiticada",
            icon: "warning",
            allowOutsideClick: true,
            onConfirm: () => {
              operative({
                step: "home",
                identifyUser: false,
              });
              cleanup();
            },
          });
        }
      } else {
        showAlert({
          title: "Intento",
          html: html(attempts),
          icon: undefined,
        });
      }

      sendStatistics(false);
      // savePhoto({
      //   personId: person.id as number,
      //   photoFace: base64toBlob(imageDataURL),
      // });
    };

    const operative = ({
      step,
      identifyUser,
    }: {
      step: string;
      identifyUser: boolean;
    }) => {
      changeStep(step);
      changeIdentifyUser(identifyUser);
      cleanup();
    };

    /**
     * Manejo de rostro reconocido.
     */
    const handleRecognizedFace = async (
      label: string,
      canvas: HTMLCanvasElement,
      detection: any
    ) => {
      console.log("================================");
      console.log("RECONOCE EL ROSTRO");
      console.log("================================");

      if (videoRef.current) {
        // Generamos la imagen para guardarla
        const video = videoRef.current;
        if (!video.paused && video.readyState === 4) {
          const cvs = document.createElement("canvas");
          cvs.width = video.videoWidth;
          cvs.height = video.videoHeight;
          const ctx = cvs.getContext("2d");
          ctx?.drawImage(video, 0, 0, cvs.width, cvs.height);

          const imageDataURL = cvs.toDataURL("image/jpeg");
          savePhoto({
            personId: person.id as number,
            photoFace: base64toBlob(imageDataURL),
          });
        }
      }

      changeRecognizedByFacialRecognition(true);
      sendStatistics(true);
      operative({ step: "home", identifyUser: true });

      new faceapi.draw.DrawBox(detection.box, {
        label,
        boxColor: "green",
      }).draw(canvas);
    };

    /**
     * Procesa las detecciones y realiza las acciones correspondientes
     */
    const processDetections = async (
      resizeResults: any[],
      canvas: HTMLCanvasElement
    ) => {
      for (const { detection, descriptor } of resizeResults) {
        if (faceMatcher) {
          const label = faceMatcher.findBestMatch(descriptor).toString();
          if (!label.includes("unknown")) {
            handleRecognizedFace(label, canvas, detection);
            return true; // Rostro reconocido
          } else {
            handleUnrecognizedFace();
            return false; // Rostro no reconocido
          }
        } else {
          console.warn("faceMatcher no está disponible");
        }
      }
      return false;
    };

    const scanPhoto = async () => {
      changeLoadingGlobal(true);
      try {
        // Validaciones iniciales
        if (!image || !isFaceDetectionModelLoad()) {
          console.error("No se cargaron los modelos o no existe la imágen");
          changeLoadingGlobal(false);
          return;
        }
        // Configuraciones de detecciones
        const options = new faceapi.TinyFaceDetectorOptions(TINY_OPTIONS_PHOTO);
        img = await faceapi.fetchImage(image);
        console.log(`Dimensiones de la img: ${img.width} x ${img.height}`);
        setFetchedImage(img);

        const canvas = document.createElement("canvas");

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
        };

        // Detección de rostros
        const detections = await faceapi
          .detectAllFaces(img, options)
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections.length === 0) {
          console.warn("No se detectaron rostros");
          handleNoDetections();
          return;
        }

        if (!canvas && !img) {
          console.warn("Canvas o imagen no disponibles");
          handleNoDetections();
          return;
        }

        faceapi.matchDimensions(canvas, img);
        const resizeResults = faceapi.resizeResults(detections, img);

        if (resizeResults.length === 0) {
          console.warn("No hay resultados ajustados");
          handleNoDetections();
          return;
        }

        // Procesamiento de detecciones
        const recognized = await processDetections(resizeResults, canvas);
        if (!recognized) {
          console.warn("Rostro no reconocido");
          handleUnrecognizedFace();
        }
        changeLoadingGlobal(false);
      } catch (error: any) {
        changeLoadingGlobal(false);
        console.error("Error con la cámara del rostro: ", error);
      }
    };
    /* =============================================================== */

    /* ========== CARGADO DE IMÁGEN PARA REALIZAR PRUEBAS ============ */
    const uploadImage = async (e: any) => {
      cleanup();
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (typeof event.target?.result === "string") {
            setImageSrc(event.target?.result);
          }
        };
        reader.readAsDataURL(file); // Leer el archivo como una URL base64
      }
    };
    /* =============================================================== */

    const cleanup = useCallback(() => {
      intervalVideo && clearInterval(intervalVideo);

      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track: MediaStreamTrack) => track.stop());
      }
    }, [videoRef]);

    const totalData = async () => {
      const personId = await getPerson(identityCard);
      if (personId !== undefined) {
        await getFingerprints(personId);
      }
    };

    useEffect(() => {
      changeLoadingGlobal(true);
      totalData();
      loadModels()
        .then(async () => {
          await scanFace();
          await getLocalUserVideo();
          setTimeout(() => {
            changeLoadingGlobal(false);
          }, 2000); // 2 segundos de espera para el enfoque automático
        })
        .catch(() => {
          console.error("No se cargaron los modelos");
          changeLoadingGlobal(false);
        });
    }, []);

    return (
      <Grid container alignItems="center">
        <Grid
          item
          container
          sm={6}
          direction="column"
          justifyContent="space-between"
        >
          <CardInfo text={text} />
        </Grid>
        <Grid item container sm={6} direction="column">
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "70vh",
            }}
          >
            <Stack spacing={2}>
              {DEV_MODE && (
                <div>
                  <input type="file" accept="image/*" onChange={uploadImage} />
                  <button onClick={scanVideo}>Escanear</button>
                </div>
              )}
              <Stack>
                {!imageSrc && (
                  <video
                    muted
                    autoPlay
                    ref={videoRef}
                    style={{
                      objectFit: "fill",
                      borderRadius: "30px",
                      backgroundColor: "#fff",
                      padding: "10px",
                      width: "40vw",
                      height: "30vw",
                    }}
                  />
                )}
                {imageSrc && (
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Seleccionada"
                    crossOrigin="anonymous"
                    style={{
                      objectFit: "fill",
                      borderRadius: "30px",
                      backgroundColor: "#fff",
                      padding: "10px",
                      width: "40vw",
                      height: "30vw",
                    }}
                  />
                )}
                <canvas
                  ref={canvasVideoRef}
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    padding: "10px",
                    width: "40vw",
                    height: "30vw",
                    zIndex: "10",
                  }}
                />
                {DEV_MODE && fetchedImage && (
                  <img
                    src={fetchedImage.src}
                    alt="Imagen de comparación"
                    style={{
                      width: "40vw",
                      height: "30vw",
                      borderRadius: "30px",
                      backgroundColor: "#fff",
                      padding: "10px",
                    }}
                  />
                )}
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    );
  })
);
