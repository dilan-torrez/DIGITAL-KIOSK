import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
import { CardComponent } from "@/components";
import { useContext, useEffect } from "react";
import { useRetirementStore } from "@/hooks/useRetirementStore";
import { useCredentialStore } from "@/hooks";
import { useLoading } from "@/hooks/useLoading";
import { useSweetAlert } from "@/hooks/useSweetAlert";
import { TimerContext } from "@/context/TimerContext";
// @ts-expect-error no proceded
import logo from "@/assets/images/aportes.png";

const sectionLabelSx = {
  fontWeight: 700,
  fontSize: 20,
  textTransform: "uppercase" as const,
  borderLeft: "4px solid #1E635A",
  pl: 1.5,
  mb: 0.5,
};

const emptyStateSx = {
  p: 2,
  border: "2px dashed #9BC5B8",
  borderRadius: "16px",
  textAlign: "center" as const,
  color: "text.secondary",
  fontSize: 18,
  lineHeight: 1.3,
};

export const BenefitsView = () => {
  const {
    retFunds,
    quotaAids,
    getRetirementFunds,
    getQuotaAids,
    printRetFunLiquidation,
    printQuotaAidLiquidation,
  } = useRetirementStore();
  const { identityCard } = useCredentialStore();
  const { setLoading } = useLoading();
  const { showAlert } = useSweetAlert();
  const { resetTimer } = useContext(TimerContext);

  useEffect(() => {
    getRetirementFunds(identityCard);
    getQuotaAids(identityCard);
  }, []);

  const printableRetFunds = (retFunds || []).filter(
    (item: any) => item.printable
  );
  const printableQuotaAids = (quotaAids || []).filter(
    (item: any) => item.printable
  );
  const totalPrintable = printableRetFunds.length + printableQuotaAids.length;

  const handlePrint = async (printFn: any) => {
    setLoading(true);
    const response: any = await printFn();
    switch (response) {
      case 200:
        showAlert({
          title: "Impresión exitosa",
          message: "Recoja su hoja impresa",
          icon: "success",
          timer: 3000,
        });
        break;
      case 400:
        showAlert({
          title: "No hay impresora conectada",
          message: "Contactese con soporte",
          icon: "warning",
          timer: 1500,
        });
        break;
      case 501:
        break;
      default:
        showAlert({
          title: "Hubo un error",
          message: "El servicio de impresión no se encuentra disponible",
          icon: "error",
          timer: 1500,
        });
        break;
    }
    setLoading(false);
    resetTimer();
  };

  const EmptyState = ({ message }: { message: string }) => (
    <Paper elevation={0} sx={emptyStateSx}>
      {message}
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        alignItems="center"
        spacing={0.5}
        sx={{ mb: 2 }}
      >
        <Typography variant="h4" sx={{ fontSize: 28, lineHeight: 1.2 }}>
          Fondo de Retiro y Cuota Auxilio Mortuorio
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          {totalPrintable === 0
            ? "No tiene liquidaciones disponibles"
            : `${totalPrintable} liquidacion${
                totalPrintable === 1 ? "" : "es"
              } disponible${totalPrintable === 1 ? "" : "s"} para imprimir`}
        </Typography>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={6}>
          <Typography sx={sectionLabelSx}>Fondo de Retiro</Typography>
          <Stack direction="column" spacing={1.5} sx={{ mt: 1 }}>
            {printableRetFunds.length > 0 ? (
              printableRetFunds.map((item: any) => (
                <CardComponent
                  layout="row"
                  procedureTitle={`Fondo de Retiro - ${item.code}`}
                  procedureDescription={`Modalidad: ${
                    item.procedure_modality ?? "-"
                  } - Tipo de Trámite: ${item.procedure_type ?? "-"}`}
                  onPressed={() =>
                    handlePrint(() => printRetFunLiquidation(item.id))
                  }
                  logo={logo}
                  key={`ret-${item.id}`}
                />
              ))
            ) : (
              <EmptyState message="No tiene liquidaciones de Fondo de Retiro disponibles" />
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography sx={sectionLabelSx}>Cuota Auxilio Mortuorio</Typography>
          <Stack direction="column" spacing={1.5} sx={{ mt: 1 }}>
            {printableQuotaAids.length > 0 ? (
              printableQuotaAids.map((item: any) => (
                <CardComponent
                  layout="row"
                  procedureTitle={`Cuota Auxilio Mortuorio - ${item.code}`}
                  procedureDescription={`Modalidad: ${
                    item.procedure_modality ?? "-"
                  } - Tipo de Trámite: ${item.procedure_type ?? "-"}`}
                  onPressed={() =>
                    handlePrint(() => printQuotaAidLiquidation(item.id))
                  }
                  logo={logo}
                  key={`quota-${item.id}`}
                />
              ))
            ) : (
              <EmptyState message="No tiene liquidaciones de Cuota Auxilio Mortuorio disponibles" />
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};
