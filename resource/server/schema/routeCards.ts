import type { CardSpec } from "@aicore-fivem/shared";

export const vehicleCard: CardSpec = {
  icon: "car",
  title: "ADMIN_C_VEHICLE",
  desc: "ADMIN_C_VEHICLE_DESC",
  fields: [
    {
      widget: "text",
      path: "vehicle",
      label: "ADMIN_F_VEHICLE",
      hint: "ADMIN_H_VEHICLE",
      placeholder: "ADMIN_P_VEHICLE",
    },
    {
      widget: "point",
      path: "spawn",
      label: "ADMIN_F_SPAWN",
      heading: true,
      ground: true,
    },
    {
      widget: "number",
      path: "pay",
      label: "ADMIN_F_PAY",
      hint: "ADMIN_H_PAY",
      min: 0,
      max: 100_000,
      unit: "$",
    },
    {
      widget: "text",
      lookup: "account",
      path: "account",
      label: "ADMIN_F_ACCOUNT",
      hint: "ADMIN_H_ACCOUNT",
    },
    {
      widget: "tags",
      path: "towModels",
      label: "ADMIN_F_TOW_MODELS",
      hint: "ADMIN_H_TOW_MODELS",
      placeholder: "ADMIN_P_VEHICLE",
      showIf: { path: "kind", values: ["tow"] },
    },
  ],
};

export const gatherCard: CardSpec = {
  icon: "box",
  title: "ADMIN_C_GATHER",
  desc: "ADMIN_C_GATHER_DESC",
  fields: [
    {
      widget: "text",
      lookup: "item",
      path: "item",
      label: "ADMIN_F_ITEM",
      hint: "ADMIN_H_ITEM",
      placeholder: "ADMIN_P_ITEM",
    },
    {
      widget: "number",
      path: "gatherMin",
      label: "ADMIN_F_GATHER_MIN",
      min: 1,
      max: 100,
    },
    {
      widget: "number",
      path: "gatherMax",
      label: "ADMIN_F_GATHER_MAX",
      hint: "ADMIN_H_GATHER_MAX",
      min: 1,
      max: 100,
    },
  ],
};
