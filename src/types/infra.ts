import type { Edge, Node } from "reactflow";

export type NetworkZone = "dmz" | "private" | "external" | "unknown";

export type ServerInventoryItem = {
  id: string;
  no: number;
  serverName: string;
  systemName: string;
  role: string;
  os: string;
  ips: string[];
  spec: string;
  availabilityZone: string;
  team: string;
  note: string;
  deletePlanned: boolean;
  networkZone: NetworkZone;
  hasPublicIp: boolean;
};

export type ServerInventoryFile = {
  source: string;
  version: string;
  count: number;
  servers: ServerInventoryItem[];
};

export type InfraNodeData = {
  label: string;
  kind:
    | "client"
    | "server"
    | "service"
    | "gateway"
    | "db"
    | "infra"
    | "secrets"
    | "batch"
    | "airflow"
    | "zone";
  server?: ServerInventoryItem;
  servers?: ServerInventoryItem[];
  logicalSubtitle?: string;
  subtitle?: string;
  spec?: string;
  zoneId?: string;
  risk?: "normal" | "warning" | "danger";
};

export type InfraPlan = {
  version: string;
  name: string;
  updatedAt: string;
  nodes: Node<InfraNodeData>[];
  edges: Edge[];
};
