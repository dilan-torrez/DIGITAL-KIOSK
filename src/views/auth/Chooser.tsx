import CardChooser from "@/components/CardChooser";
import { useCredentialStore } from "@/hooks";
import { useChooserStore } from "@/hooks/useChooserStore";
import { Container, Grid, styled } from "@mui/material";
import SERVICES from "@/views/content/menu";
import { useCallback, useEffect, useState } from "react";

// Por encima de este cantidad de servicios las tarjetas dejan de caber apiladas
// en una sola columna, asi que se pasan a un mosaico de dos columnas.
const MOSAIC_THRESHOLD = 4;

const StyledBox = styled("div")({
  flexGrow: 1,
  minHeight: "80vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
});

const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(8),
}));

const StyledGrid = styled(Grid, {
  shouldForwardProp: (prop) => prop !== "$mosaic",
})<{ $mosaic?: boolean }>(({ theme, $mosaic }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "stretch",
  // En mosaico cada item ocupa el 50% exacto del ancho, asi que un columnGap
  // sumaria mas del 100% y la segunda tarjeta saltaria de linea. La separacion
  // horizontal se resuelve con padding del item y aqui solo queda el rowGap.
  columnGap: $mosaic ? 0 : theme.spacing(5),
  rowGap: theme.spacing($mosaic ? 3 : 5),
}));

export const Chooser = () => {
  const { changeStep, identityCard } = useCredentialStore();
  const { saveSelection, getValidProcedures } = useChooserStore();

  const [enabledServices, setEnabledServices] = useState<any[]>([]);

  const mosaic = enabledServices.length >= MOSAIC_THRESHOLD;

  const action = useCallback(
    (code: string) => {
      saveSelection(code);
      changeStep("recognitionCard");
    },
    [saveSelection, changeStep]
  );

  const matchServices = async () => {
    if (identityCard) {
      const proc = await getValidProcedures(identityCard);      
      if (proc) {
        const filteredServices = SERVICES.filter(
          (service) => service.code in proc && proc[service.code].canShow
        ).map((service)=>{
          service.message = proc[service.code].message;
          service.canCreate = proc[service.code].canCreate ?? true;
          return service;
        });
        setEnabledServices(filteredServices);
      } else {
        console.log("Proc no tiene formato esperado");
      }
    }
  };

  useEffect(() => {
    matchServices();
  }, [identityCard]);

  return (
    <StyledBox>
      <StyledContainer maxWidth="lg">
        <StyledGrid container $mosaic={mosaic}>
          {enabledServices ? (
            enabledServices.map((service: any) => (
              <CardChooser
                key={service.code}
                title={service.title}
                subTitle={service.subTitle}
                message={service.message}
                canCreate={service.canCreate}
                icon={service.icon}
                code={service.code}
                mosaic={mosaic}
                onAction={action}
              />
            ))
          ) : (
            <>Sin servicios</>
          )}
        </StyledGrid>
      </StyledContainer>
    </StyledBox>
  );
};
