import type { Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

export const createBaseNodes = (): Node<InfraNodeData>[] => [
  {
    id: "zone-dmz",
    type: "zoneNode",
    position: { x: 40, y: 80 },
    selectable: false,
    draggable: false,
    data: { label: "DMZ VPC", subtitle: "192.168.0.0/24", kind: "zone" },
  },
  {
    id: "zone-private",
    type: "zoneNode",
    position: { x: 420, y: 80 },
    selectable: false,
    draggable: false,
    data: { label: "Private VPC", subtitle: "172.20.0.0/24", kind: "zone" },
  },
  {
    id: "zone-db",
    type: "zoneNode",
    position: { x: 420, y: 500 },
    selectable: false,
    draggable: false,
    data: { label: "DB Layer", subtitle: "Private only", kind: "zone" },
  },
  {
    id: "zone-mgmt",
    type: "zoneNode",
    position: { x: 40, y: 500 },
    selectable: false,
    draggable: false,
    data: { label: "MGMT / Security", subtitle: "Access control · backup · encryption", kind: "zone" },
  },
];
