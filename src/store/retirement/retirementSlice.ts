import { createSlice } from "@reduxjs/toolkit";

export const retirementSlice = createSlice({
  name: "retirement",
  initialState: {
    retFunds: <any>[],
    quotaAids: <any>[],
  },
  reducers: {
    setRetFunds: (state, action) => {
      state.retFunds = action.payload.retFunds;
    },
    setQuotaAids: (state, action) => {
      state.quotaAids = action.payload.quotaAids;
    },
  },
});

export const { setRetFunds, setQuotaAids } = retirementSlice.actions;