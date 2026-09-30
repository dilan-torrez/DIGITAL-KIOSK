import { ImageCapture } from "@/components";
import { CardInfo } from "@/components/CardInfo";
import { base64toBlob, getEnvVariables } from "@/helpers";
import { useCredentialStore, useStastisticsStore } from "@/hooks";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useBiometricStore } from "@/hooks/useBiometric";
import { usePersonStore } from "@/hooks/usePersonStore";
import { Box, Grid, Stack, styled } from "@mui/material";
import * as faceapi from "face-api.js";
import {
  RefObject,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Webcam from "react-webcam";
import "src/styles.css";

const TINY_OPTIONS = {
  inputSize: 320,
  scoreThreshold: 0.5,
};

type ImageViewRef = {
  onCapture: () => void;
};

const DEV_MODE = getEnvVariables().DEV_MODE === "true";

const text = (
  <>
    Introduzca su <b>carnet de identidad</b> en la bandeja inferior y
    presione <b>CONTINUAR</b><br />
  </>
  // <>
  //   Deposite su <b>carnet de identidad</b> en el <b>soporte inferior</b> y
  //   presione en <b>CONTINUAR</b><br />
  // </>
);

const StyledBox = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "70vh",
  [theme.breakpoints.down("sm")]: {
    height: "60vh",
  },
}));

const getCameras = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === "videoinput");
};

const getUsbCamera = async () => {
  const cameras = await getCameras();
  return cameras.find(c =>
    c.label.toLowerCase().includes("logitech")
  );
};

export const OcrView = memo(
  forwardRef((_, ref) => {
    useImperativeHandle(ref, () => ({
      action: async () => {
        await imageCaptureRef.current!.onCapture();
      },
      onRemoveCam: () => cleanup(),
    }));

    let intervalWebCam: NodeJS.Timeout;

    const [image, setImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const foundRef = useRef<any>(undefined);

    const imageCaptureRef: RefObject<ImageViewRef> = useRef(null);
    const webcamRef: RefObject<Webcam> = useRef(null);
    const canvasWebcamRef: any = useRef(null);

    const {
      identityCard,
      changeStep,
      changeImage,
      changeRecognizedByOcr,
      changeLoadingGlobal,
      savePhoto,
    } = useCredentialStore();
    const { authMethodRegistration } = useAuthStore();
    const { leftText, rightText } = useStastisticsStore();
    const { person, getPerson } = usePersonStore();
    const { getFingerprints } = useBiometricStore();

    /* ====== CONFIGURACIÓN DE LOS PESOS DEL MODELO DE FACEAPI ====== */
    const loadModels = async () => {
      const uri = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.ssdMobilenetv1.loadFromUri(uri),
        faceapi.nets.faceLandmark68Net.loadFromUri(uri),
        faceapi.nets.faceRecognitionNet.loadFromUri(uri),
      ]);
    };
    /* ============================================================== */

    /* =========== CONFIGURACIÓN DE LA CÁMARA DE VIDEO   ============ */
    const setManualFocus = async (
      stream: MediaStream,
      focusDistance: number
    ) => {
      const track = stream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities();
      // Configura el enfoque si está disponible
      if (capabilities.focusMode && capabilities.focusMode.includes("manual")) {
        const constraints: any = {
          focusMode: "manual",
          focusDistance: focusDistance,
        };
        await track.applyConstraints(constraints);
      } else {
        console.log("El enfoque manual no es compatible con este dispositivo.");
      }
    };

    const getLocalUserVideo = async () => {
      try {
        const cam = await getUsbCamera();
        if (!cam) throw new Error("Cámara USB no encontrada");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: cam.deviceId },
            width: 1920,
            height: 1080,
          },
          audio: false,
        });

        await setManualFocus(stream, 120);
        // @ts-expect-error type is not known
        webcamRef.current!.srcObject = stream;
      } catch (error) {
        console.error("Error cámara OCR:", error);
      }
    };
    /* ============================================================== */

    /* =========== PROCESAMIENTO DE LA IMÁGEN CAPTURADA ============= */
    const cleanup = useCallback(() => {
      intervalWebCam && clearInterval(intervalWebCam);
      // @ts-expect-error type is not known
      if (webcamRef.current && webcamRef.current.srcObject)
        // @ts-expect-error type is not known
        webcamRef.current.srcObject
          .getTracks()
          .forEach((track: MediaStreamTrack) => track.stop());
    }, [webcamRef]);

    const sendStatistics = (
      ocrState: boolean,
      recognizedTextCaptured: string = ""
    ) => {
      const body = {
        identity_card: identityCard,
        left_text: leftText,
        right_text: rightText,
        ocr_state: ocrState,
        facial_recognition: false,
        person_id: parseInt(person.id, 10),
        recognized_text_captured: recognizedTextCaptured,
      };
      authMethodRegistration(body);
    };

    const findSimilarSubstring = (needle: string, haystack: string[]) => {
      // ? falsos positivos: cuando el número de carnet digitado y el carnet introducido
      // ? solo varian por dos digitos al inicio y final. Ej. (inicio) 8900123, 1100123
      // ? Ej. (final) 8900123, 8900178
      // Longitudes minimas permitidas
      const MARGIN_OF_ERROR = 2;
      const NEEDLE_MIN_LENGTH = 4;
      const HAYSTACK_MIN_LENGTH = NEEDLE_MIN_LENGTH - MARGIN_OF_ERROR;

      for (let i = 0; i < haystack.length; i++) {
        if (
          needle.length < NEEDLE_MIN_LENGTH &&
          haystack[i].length < HAYSTACK_MIN_LENGTH
        )
          return { found: false };
        // Primero intentamos buscar la cadena completa (needle) en haystack
        const foundIndex = haystack[i].indexOf(needle);

        // Si encontramos una coincidencia exacta, la devolvemos
        if (foundIndex !== -1)
          return {
            found: true,
            index: foundIndex,
            modified: needle,
            chart: i + 1,
          };
      }
      // Si no la encontramos, probamos con cadenas más pequeñas
      for (let k = 0; k < haystack.length; k++) {
        for (let i = 1; i <= MARGIN_OF_ERROR; i++) {
          const subNeedle1 = needle.slice(0, needle.length - i); // Eliminando desde el final
          const subNeedle2 = needle.slice(i); // Eliminado desde el inicio
          // Buscamos las cadenas recortadas en el pajar
          if (haystack[k].includes(subNeedle1))
            return {
              found: true,
              index: haystack[k].indexOf(subNeedle1),
              modified: subNeedle1,
              chart: k + 1,
            };
          if (haystack[k].includes(subNeedle2))
            return {
              found: true,
              index: haystack[k].indexOf(subNeedle2),
              modified: subNeedle2,
              chart: k + 1,
            };
        }
      }
      // Si no encontramos ninguna coincidencia
      return { found: false };
    };

    const isWithinErrorRange = (
      previouslyEnteredText: string,
      previouslyRecognizedText: string[]
    ): boolean => {
      const enteredText = previouslyEnteredText.replace(/[^\d]/g, "");
      const recognizedText = previouslyRecognizedText.map((recognized) => {
        return recognized.replace(/[\s]/g, "");
      });
      // const recognizedText = previouslyRecognizedText.replace(/[\s]/g, "");
      console.log("***************************************************");
      console.log("TEXTO INGRESADO: \n-->\t", enteredText);
      console.log("***************************************************");
      console.log("TEXTO RECONOCIDO: \n-->\t", recognizedText);
      console.log("***************************************************");
      const result = findSimilarSubstring(enteredText, recognizedText);
      if (result.found) {
        foundRef.current = result;
        console.log(
          `Cadena encontrada en el cuadro N° ${result.chart}\ncon la variante: ${result.modified}`
        );
        console.log("***************************************************");
        return true;
      }
      console.log("No se encontró ninguna coincidencia");
      return false;
    };

    const handleImageCapture = useCallback(
      (image: string, text: string[]) => {
        setImage(image);
        const isValid = isWithinErrorRange(identityCard, text);
        if (isValid) {
          changeRecognizedByOcr(isValid);
          changeImage(image);
          cleanup();
          sendStatistics(isValid, foundRef.current.modified);
        } else {
          setImage(null);
          getLocalUserVideo();
          sendStatistics(isValid);
        }
        changeImage(image);
        changeStep("authMethodChooser");
        savePhoto({
          personId: person.id,
          photoIdentityCard: base64toBlob(image),
        });
      },
      [image, changeImage]
    );
    /* ============================================================== */

    /* ========== WEBCAM DETECCIÓN DEL ROSTRO EN EL CARNET ========== */
    const isFaceDetectionModelLoad = () =>
      !!faceapi.nets.tinyFaceDetector.params;

    const scanWebcam = async () => {
      if (!isFaceDetectionModelLoad) return;
      const options = new faceapi.TinyFaceDetectorOptions(TINY_OPTIONS);

      intervalWebCam = setInterval(async () => {
        if (!webcamRef.current) clearInterval(intervalWebCam);
        else {
          const imageSrc = webcamRef.current.getScreenshot();
          if (!imageSrc) return;
          const img = await faceapi.fetchImage(imageSrc);
          const detections = await faceapi
            .detectAllFaces(img, options)
            .withFaceLandmarks()
            .withFaceDescriptors();
          if (canvasWebcamRef.current && img) {
            const dims = faceapi.matchDimensions(
              canvasWebcamRef.current,
              img,
              true
            );
            const resizedDetections = faceapi.resizeResults(detections, dims);
            detections.forEach(({ detection }) => {
              const boxStyle = {
                label: "Persona",
                lineWidth: 3,
                boxColor: "green",
                drawLabel: true,
              };
              new faceapi.draw.DrawBox(detection.box, boxStyle).draw(
                canvasWebcamRef.current
              );
            });
            faceapi.draw.drawFaceLandmarks(
              canvasWebcamRef.current,
              resizedDetections
            );
          }
        }
      }, 60);
    };
    /* ============================================================== */

    /* ========== CARGADO DE IMAGEN PARA REALIZAR PRUEBAS =========== */
    const uploadImage = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imgData = event.target?.result;
          if (typeof imgData === "string") {
            setImage(imgData);
          }
        };
        reader.readAsDataURL(file);
      }
    };
    /* ============================================================== */

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
          await scanWebcam();
          await getLocalUserVideo();
          changeLoadingGlobal(false);
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
          <StyledBox>
            <Stack>
              {DEV_MODE && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadImage}
                    ref={fileInputRef}
                  />
                </div>
              )}
              <ImageCapture
                onChange={handleImageCapture}
                ref={imageCaptureRef}
                webcamRef={webcamRef}
                canvasWebcamRef={canvasWebcamRef}
                uploadImage={image}
              />
            </Stack>
          </StyledBox>
        </Grid>
      </Grid>
    );
  })
);
