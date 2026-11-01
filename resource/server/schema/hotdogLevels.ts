import type { CardSpec, WidgetSpec } from "@aicore-fivem/shared";

const NEW_LEVEL = {
  rep: 0,
  stock: 15,
  exoticMin: 8,
  exoticMax: 12,
  rareMin: 6,
  rareMax: 9,
  commonMin: 4,
  commonMax: 6,
};

const priceRow = (path: string, key: string): WidgetSpec => ({
  widget: "number",
  path,
  label: `ADMIN_F_HD_${key}`,
  min: 0,
  max: 10_000,
  unit: "$",
});

export const levelsCard: CardSpec = {
  icon: "list",
  title: "ADMIN_C_HD_LEVELS",
  desc: "ADMIN_C_HD_LEVELS_DESC",
  fields: [
    {
      widget: "list",
      path: "levels",
      label: "ADMIN_F_HD_LEVELS",
      addLabel: "ADMIN_ADD_HD_LEVEL",
      max: 10,
      newRow: NEW_LEVEL,
      rows: [
        {
          widget: "number",
          path: "rep",
          label: "ADMIN_F_HD_LEVEL_REP",
          min: 0,
          max: 100_000,
        },
        {
          widget: "number",
          path: "stock",
          label: "ADMIN_F_HD_LEVEL_STOCK",
          min: 1,
          max: 1000,
        },
      ],
    },
  ],
};

export const pricesCard: CardSpec = {
  icon: "tag",
  title: "ADMIN_C_HD_PRICES",
  desc: "ADMIN_C_HD_PRICES_DESC",
  fields: [
    {
      widget: "list",
      path: "levels",
      label: "ADMIN_F_HD_LEVELS",
      addLabel: "ADMIN_ADD_HD_LEVEL",
      max: 10,
      newRow: NEW_LEVEL,
      rows: [
        priceRow("exoticMin", "EXOTIC_MIN"),
        priceRow("exoticMax", "EXOTIC_MAX"),
        priceRow("rareMin", "RARE_MIN"),
        priceRow("rareMax", "RARE_MAX"),
        priceRow("commonMin", "COMMON_MIN"),
        priceRow("commonMax", "COMMON_MAX"),
      ],
    },
  ],
};
