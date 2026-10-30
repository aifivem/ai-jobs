import type { PanelSchema } from "@aicore-fivem/shared";

/** ai-jobs' panel: work routes and their stops (each stop its own record so its place is set in the world). */
export const jobsSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "briefcase",
  files: {
    routes: {
      kind: "records",
      sync: "all",
      labelPath: "label",
      newRecord: { label: "", kind: "random", job: "", depot: { x: 0, y: 0, z: 0 }, vehicle: "", spawn: { x: 0, y: 0, z: 0, heading: 0 }, pay: 100, seconds: 5, item: "", stops: 5 },
      sections: {
        label: { type: "text", min: 1, max: 48 },
        kind: { type: "enum", values: ["ordered", "random", "gather", "tow"] },
        job: { type: "text", min: 0, max: 32 },
        depot: { type: "vec3" },
        vehicle: { type: "text", min: 0, max: 32 },
        spawn: { type: "vec4" },
        pay: { type: "number", min: 0, max: 100_000, integer: true },
        seconds: { type: "number", min: 0, max: 120, integer: true },
        item: { type: "text", min: 0, max: 48 },
        stops: { type: "number", min: 0, max: 100, integer: true },
      },
    },
    stops: {
      kind: "records",
      sync: "all",
      keyPattern: "^[a-z0-9_]{2,48}$",
      labelPath: "label",
      newRecord: { route: "taxi", label: "", coords: { x: 0, y: 0, z: 0 } },
      sections: { route: { type: "text", min: 2, max: 32 }, label: { type: "text", min: 1, max: 48 }, coords: { type: "vec3" } },
    },
  },
  tabs: [
    {
      id: "routes",
      file: "routes",
      icon: "briefcase",
      label: "ADMIN_TAB_ROUTES",
      desc: "ADMIN_TAB_ROUTES_DESC",
      listSub: "kind",
      createLabel: "ADMIN_NEW_ROUTE",
      deleteLabel: "ADMIN_DELETE_ROUTE",
      cards: [
        {
          icon: "briefcase",
          title: "ADMIN_C_ROUTE",
          desc: "ADMIN_C_ROUTE_DESC",
          fields: [
            { widget: "text", path: "label", label: "ADMIN_F_LABEL", placeholder: "ADMIN_P_LABEL" },
            {
              widget: "select",
              path: "kind",
              label: "ADMIN_F_KIND",
              hint: "ADMIN_H_KIND",
              options: [
                { value: "random", label: "ADMIN_O_RANDOM" },
                { value: "ordered", label: "ADMIN_O_ORDERED" },
                { value: "gather", label: "ADMIN_O_GATHER" },
                { value: "tow", label: "ADMIN_O_TOW" },
              ],
            },
            { widget: "text", path: "job", label: "ADMIN_F_JOB", hint: "ADMIN_H_JOB", placeholder: "ADMIN_P_JOB" },
            { widget: "point", path: "depot", label: "ADMIN_F_DEPOT", hint: "ADMIN_H_DEPOT", ground: true },
            { widget: "number", path: "stops", label: "ADMIN_F_STOPS", hint: "ADMIN_H_STOPS", min: 0, max: 100 },
            { widget: "number", path: "seconds", label: "ADMIN_F_SECONDS", hint: "ADMIN_H_SECONDS", min: 0, max: 120, unit: "s" },
          ],
        },
        {
          icon: "car",
          title: "ADMIN_C_VEHICLE",
          desc: "ADMIN_C_VEHICLE_DESC",
          fields: [
            { widget: "text", path: "vehicle", label: "ADMIN_F_VEHICLE", hint: "ADMIN_H_VEHICLE", placeholder: "ADMIN_P_VEHICLE" },
            { widget: "point", path: "spawn", label: "ADMIN_F_SPAWN", heading: true, ground: true },
            { widget: "number", path: "pay", label: "ADMIN_F_PAY", hint: "ADMIN_H_PAY", min: 0, max: 100_000, unit: "$" },
          ],
        },
        {
          icon: "box",
          title: "ADMIN_C_GATHER",
          desc: "ADMIN_C_GATHER_DESC",
          fields: [{ widget: "text", path: "item", label: "ADMIN_F_ITEM", hint: "ADMIN_H_ITEM", placeholder: "ADMIN_P_ITEM" }],
        },
      ],
    },
    {
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
            { widget: "text", path: "route", label: "ADMIN_F_ROUTE", hint: "ADMIN_H_ROUTE", placeholder: "ADMIN_P_ROUTE" },
            { widget: "text", path: "label", label: "ADMIN_F_STOP_LABEL", placeholder: "ADMIN_P_STOP_LABEL" },
            { widget: "point", path: "coords", label: "ADMIN_F_COORDS", hint: "ADMIN_H_COORDS", ground: true },
          ],
        },
      ],
    },
  ],
};
