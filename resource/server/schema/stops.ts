import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const stopsFile: FileSpec = {
  kind: "records",
  sync: "all",
  keyPattern: "^[a-z0-9_]{2,48}$",
  labelPath: "label",
  newRecord: { route: "taxi", label: "", coords: { x: 0, y: 0, z: 0 } },
  sections: {
    route: { type: "text", min: 2, max: 32 },
    label: { type: "text", min: 1, max: 48 },
    coords: { type: "vec3" },
  },
};

export const stopsTab: TabSpec = {
  id: "stops",
  file: "stops",
  icon: "location-dot",
  label: "ADMIN_TAB_STOPS",
  desc: "ADMIN_TAB_STOPS_DESC",
  listSub: "route",
  createLabel: "ADMIN_NEW_STOP",
  deleteLabel: "ADMIN_DELETE_STOP",
  cards: [
    {
      icon: "location-dot",
      title: "ADMIN_C_STOP",
      desc: "ADMIN_C_STOP_DESC",
      fields: [
        {
          widget: "text",
          path: "route",
          label: "ADMIN_F_ROUTE",
          hint: "ADMIN_H_ROUTE",
          placeholder: "ADMIN_P_ROUTE",
        },
        {
          widget: "text",
          path: "label",
          suggest: { from: "coords" },
          label: "ADMIN_F_STOP_LABEL",
          placeholder: "ADMIN_P_STOP_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_COORDS",
          hint: "ADMIN_H_COORDS",
          ground: true,
        },
      ],
    },
  ],
};
