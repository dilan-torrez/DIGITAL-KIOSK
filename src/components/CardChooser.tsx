import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  styled,
  Typography,
} from "@mui/material";
import React, { cloneElement, memo } from "react";

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: "white",
  "&:hover": {
    transform: "scale(0.95)",
    transition: "transform 0.2s ease",
  },
  borderRadius: "20px",
  boxShadow: theme.shadows[1],
}));

const DisabledCard = styled(Card)(({ theme }) => ({
  backgroundColor: "#D5DAD0",
  color: "#616161",
  borderRadius: "20px",
  boxShadow: theme.shadows[1],
}));

interface CardChooserProps {
  title: string;
  subTitle: string;
  message: string;
  canCreate: boolean;
  icon: React.ReactElement;
  code: string;
  mosaic?: boolean;
  onAction: (code: string) => void;
}

const sxIcon = {
  fontSize: 128,
  color: "green",
  mr: 5,
  ml: 3,
  my: 2,
};

const sxIconMosaic = {
  fontSize: 96,
  color: "green",
  mr: 3,
  ml: 2,
  my: 2,
};

const CardChooser = memo((props: CardChooserProps) => {
  const { title, subTitle, message, canCreate, icon, code, mosaic, onAction } =
    props;
  const CardComponent = canCreate ? StyledCard : DisabledCard;
  return (
    <Grid item xs={12} md={mosaic ? 6 : 12} sx={mosaic ? { px: 1.5 } : {}}>
      <CardComponent
        variant="outlined"
        sx={mosaic ? { height: "100%" } : undefined}
      >
        <CardActionArea onClick={() => canCreate && onAction(code)} disabled={!canCreate}>
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              ...(mosaic ? { py: 1.5 } : {}),
            }}
          >
            {icon &&
              cloneElement(icon as React.ReactElement, {
                sx: mosaic ? sxIconMosaic : sxIcon,
                variant: "outlined",
              })}
            <Box sx={mosaic ? { mr: 1, my: 2 } : { mr: 2, my: 6 }}>
              <Typography
                sx={{ fontWeight: 700, fontSize: mosaic ? 30 : 40 }}
                variant="h4"
              >
                {title}
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontSize: mosaic ? 26 : 40, lineHeight: mosaic ? 1.3 : undefined }}
              >
                {subTitle}
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontSize: mosaic ? 18 : 25, lineHeight: mosaic ? 1.3 : undefined }}
              >
                {message}
              </Typography>
            </Box>
          </CardContent>
        </CardActionArea>
      </CardComponent>
    </Grid>
  );
});

export default CardChooser;
