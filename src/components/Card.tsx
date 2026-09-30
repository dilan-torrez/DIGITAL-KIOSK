import {
  Box,
  Card,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import "src/styles.css";
import { Print } from "@mui/icons-material";
import { memo } from "react";

interface Props {
  onPressed: () => void;
  logo: any;
  procedureTitle: string;
  procedureDescription?: string;
  layout?: "block" | "row";
}

export const CardComponent = memo((props: Props) => {
  const { onPressed, logo, procedureTitle, procedureDescription, layout } =
    props;
  const compact = layout === "row";

  const printButton = (
    <Card
      sx={{
        px: compact ? 2.5 : 1,
        py: compact ? 1.25 : 2,
        my: compact ? 0 : 1,
        backgroundColor: "#1E635A",
        borderRadius: "10px",
      }}
    >
      <Stack
        direction="row"
        justifyContent="center"
        alignItems="center"
        spacing={compact ? 1 : 3}
      >
        <Typography
          variant="h4"
          sx={{
            color: "white",
            textAlign: "center",
            fontWeight: 700,
            fontSize: compact ? 24 : undefined,
            lineHeight: 1.2,
          }}
        >
          IMPRIMIR
        </Typography>
        <Print
          fontSize="large"
          sx={{ color: "white", fontSize: compact ? 28 : undefined }}
        />
      </Stack>
    </Card>
  );

  if (compact) {
    return (
      <Paper
        sx={{
          p: 2.5,
          backgroundColor: "#9BC5B8",
          borderRadius: "20px",
        }}
        onClick={() => onPressed()}
        className="dynamic"
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={2.5}
          sx={{ minHeight: 240 }}
        >
          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img
              src={logo}
              alt={procedureTitle}
              style={{ width: 120, height: 120 }}
            />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: "black",
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 1.25,
                textTransform: "uppercase",
              }}
            >
              {procedureTitle}
            </Typography>
            {procedureDescription ? (
              <Typography
                sx={{ color: "black", fontSize: 24, lineHeight: 1.25 }}
              >
                {procedureDescription}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ flexShrink: 0 }}>{printButton}</Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        sx={{ p: 3, mx: 5, backgroundColor: "#9BC5B8", borderRadius: "20px" }}
        onClick={() => onPressed()}
        className="dynamic"
      >
        <Grid container alignContent="center" justifyContent="center">
          <Grid item xs={5} alignSelf="center">
            <img
              src={logo}
              alt={procedureTitle}
              style={{ width: "10vw", height: "10vw" }}
            />
          </Grid>
          <Grid container item xs={6}>
            <Grid item xs={12} alignSelf="center">
              <Typography
                variant="h4"
                sx={{ color: "black", textAlign: "center", fontWeight: 700 }}
              >
                {procedureTitle}
              </Typography>
            </Grid>
            {procedureDescription ? (
              <Grid item xs={12}>
                <Typography
                  variant="h5"
                  sx={{ color: "black", textAlign: "center" }}
                >
                  {procedureDescription}
                </Typography>
              </Grid>
            ) : null}
            <Grid item xs={12}>
              {printButton}
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </>
  );
});
