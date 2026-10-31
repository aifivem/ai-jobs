import {
  ACCESS_FIELDS,
  accessFields,
  BLIP_STYLE_FIELDS,
  PLACE_PED_SPEC,
  placePedFields,
} from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec, WidgetSpec } from "@aicore-fivem/shared";

/** The hot dog stand's panel file and tab (one settings file: one counter, as qb-hotdogjob). */

const price = { type: "number", min: 0, max: 10_000, integer: true } as const;
const account = {
  type: "text",
  lookup: "account",
  min: 2,
  max: 32,
  pattern: "^[a-z0-9_]{2,32}$",
} as const;

export const HOTDOG_FILE: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    enabled: { type: "bool" },
    ...ACCESS_FIELDS,
    coords: { type: "vec3" },
    ped: PLACE_PED_SPEC,
    blip: { type: "object", fields: BLIP_STYLE_FIELDS },
    spawn: { type: "vec4" },
    model: { type: "text", min: 2, max: 64 },
    deposit: { type: "number", min: 0, max: 1_000_000, integer: true },
    depositAccount: account,
    payAccount: account,
    checks: { type: "number", min: 1, max: 10, integer: true },
    repGain: {
      type: "object",
      fields: {
        exotic: { type: "number", min: 0, max: 100, integer: true },
        rare: { type: "number", min: 0, max: 100, integer: true },
        common: { type: "number", min: 0, max: 100, integer: true },
      },
    },
    maxRep: { type: "number", min: 0, max: 100_000, integer: true },
    levels: {
      type: "list",
      min: 1,
      max: 10,
      of: {
        type: "object",
        fields: {
          rep: { type: "number", min: 0, max: 100_000, integer: true },
          stock: { type: "number", min: 1, max: 1000, integer: true },
          exoticMin: price,
          exoticMax: price,
          rareMin: price,
          rareMax: price,
          commonMin: price,
          commonMax: price,
        },
      },
    },
  },
};

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

const num = (
  path: string,
  key: string,
  max: number,
  unit?: string,
): WidgetSpec => ({
  widget: "number",
  path,
  label: `ADMIN_F_HD_${key}`,
  hint: `ADMIN_H_HD_${key}`,
  min: 0,
  max,
  ...(unit ? { unit } : {}),
});
const priceRow = (path: string, key: string): WidgetSpec => ({
  widget: "number",
  path,
  label: `ADMIN_F_HD_${key}`,
  min: 0,
  max: 10_000,
  unit: "$",
});

export const HOTDOG_TAB: TabSpec = {
  id: "hotdog",
  file: "hotdog",
  icon: "utensils",
  label: "ADMIN_TAB_HOTDOG",
  desc: "ADMIN_TAB_HOTDOG_DESC",
  cards: [
    {
      icon: "store",
      title: "ADMIN_C_HD_STAND",
      desc: "ADMIN_C_HD_STAND_DESC",
      fields: [
        {
          widget: "switch",
          path: "enabled",
          label: "ADMIN_F_HD_ENABLED",
          hint: "ADMIN_H_HD_ENABLED",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_HD_COORDS",
          hint: "ADMIN_H_HD_COORDS",
          ground: true,
        },
        {
          widget: "point",
          path: "spawn",
          label: "ADMIN_F_HD_SPAWN",
          hint: "ADMIN_H_HD_SPAWN",
          heading: true,
          ground: true,
        },
        {
          widget: "model",
          kind: "object",
          path: "model",
          label: "ADMIN_F_HD_MODEL",
          placeholder: "ADMIN_P_HD_MODEL",
        },
        ...accessFields(),
        { widget: "blip", path: "blip", label: "ADMIN_F_HD_BLIP" },
      ],
    },
    {
      icon: "money-bill-wave",
      title: "ADMIN_C_HD_MONEY",
      desc: "ADMIN_C_HD_MONEY_DESC",
      fields: [
        num("deposit", "DEPOSIT", 1_000_000, "$"),
        {
          widget: "text",
          lookup: "account",
          path: "depositAccount",
          label: "ADMIN_F_HD_DEPOSIT_ACCOUNT",
          hint: "ADMIN_H_HD_DEPOSIT_ACCOUNT",
          placeholder: "ADMIN_P_HD_ACCOUNT",
        },
        {
          widget: "text",
          lookup: "account",
          path: "payAccount",
          label: "ADMIN_F_HD_PAY_ACCOUNT",
          hint: "ADMIN_H_HD_PAY_ACCOUNT",
          placeholder: "ADMIN_P_HD_ACCOUNT",
        },
      ],
    },
    {
      icon: "ranking-star",
      title: "ADMIN_C_HD_SKILL",
      desc: "ADMIN_C_HD_SKILL_DESC",
      fields: [
        num("checks", "CHECKS", 10),
        num("repGain.exotic", "REP_EXOTIC", 100),
        num("repGain.rare", "REP_RARE", 100),
        num("repGain.common", "REP_COMMON", 100),
        num("maxRep", "MAX_REP", 100_000),
      ],
    },
    {
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
    },
    {
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
    },
    {
      icon: "user",
      title: "ADMIN_C_PED",
      desc: "ADMIN_C_PED_DESC",
      fields: placePedFields(),
    },
  ],
};
