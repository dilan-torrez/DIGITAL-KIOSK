import { externalApi, gatewayApi } from "@/services";
import { setQuotaAids, setRetFunds } from "@/store";
import { useDispatch, useSelector } from "react-redux";
import { useSweetAlert } from "./useSweetAlert";

const api = gatewayApi;
const apiExternal = externalApi;

export const useRetirementStore = () => {
  const { retFunds, quotaAids } = useSelector((state: any) => state.retirement);
  const dispatch = useDispatch();
  const { showAlert } = useSweetAlert();

  const getRetirementFunds = async (identityCard: string) => {
    try {
      const { data } = await api.get(`/kiosk/ret_fun?ci=${identityCard}`);
      dispatch(setRetFunds({ retFunds: data.data }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Error de conexión";
      showAlert({
        title: "Hubo un error",
        message,
        icon: "error",
      });
      console.error("No se pudo obtener el fondo de retiro");
    }
  };

  const getQuotaAids = async (identityCard: string) => {
    try {
      const { data } = await api.get(`/kiosk/quotaAid?ci=${identityCard}`);
      dispatch(setQuotaAids({ quotaAids: data.data }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Error de conexión";
      showAlert({
        title: "Hubo un error",
        message,
        icon: "error",
      });
      console.error("No se pudo obtener la cuota y auxilio mortuorio");
    }
  };

  const printRetFunLiquidation = async (retirementFundId: number) => {
    try {
      // @ts-expect-error no necesary
      const { data } = await Promise.race([
        api.get(`/kiosk/ret_fun/${retirementFundId}/print/liquidation`, {
          responseType: "arraybuffer",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 60000)
        ),
      ]);
      if (data) {
        const file = new Blob([data], { type: "application/pdf" });
        const formData = new FormData();
        formData.append("pdfFile", file, "ret_fun_liquidation.pdf");
        const res: any = await Promise.race([
          await apiExternal.post("/printer/print/", formData),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 60000)
          ),
        ]);
        if (res) {
          if (res.status == 200) {
            return res.status;
          }
        }
      }
    } catch (error: any) {
      if (error.code) {
        if (error.code == "ERR_NETWORK") {
          return 500;
        }
      } else if (error.response) {
        const message = error.response?.data?.message || "Error de conexión";
        showAlert({
          title: "Hubo un error",
          message,
          icon: "error",
        });
        return 501;
      }
    }
  };

  const printQuotaAidLiquidation = async (quotaAidId: number) => {
    try {
      // @ts-expect-error no necesary
      const { data } = await Promise.race([
        api.get(`/kiosk/quotaAid/${quotaAidId}/print/liquidation`, {
          responseType: "arraybuffer",
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 60000)
        ),
      ]);
      if (data) {
        const file = new Blob([data], { type: "application/pdf" });
        const formData = new FormData();
        formData.append("pdfFile", file, "quota_aid_liquidation.pdf");
        const res: any = await Promise.race([
          await apiExternal.post("/printer/print/", formData),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 60000)
          ),
        ]);
        if (res) {
          if (res.status == 200) {
            return res.status;
          }
        }
      }
    } catch (error: any) {
      if (error.code) {
        if (error.code == "ERR_NETWORK") {
          return 500;
        }
      } else if (error.response) {
        const message = error.response?.data?.message || "Error de conexión";
        showAlert({
          title: "Hubo un error",
          message,
          icon: "error",
        });
        return 501;
      }
    }
  };

  return {
    retFunds,
    quotaAids,
    getRetirementFunds,
    getQuotaAids,
    printRetFunLiquidation,
    printQuotaAidLiquidation,
  };
};