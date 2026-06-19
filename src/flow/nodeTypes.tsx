import {
  Braces,
  Boxes,
  Database,
  Globe2,
  KeyRound,
  Layers,
  Network,
  Server,
  Smartphone,
  Wind,
  Workflow,
} from "lucide-react";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { InfraNodeData, ServerInventoryItem } from "../types/infra";

const iconByKind = {
  client: Smartphone,
  server: Server,
  service: Braces,
  gateway: Network,
  db: Database,
  infra: Boxes,
  secrets: KeyRound,
  batch: Workflow,
  airflow: Wind,
  zone: Layers,
};

const assignedServers = (data: InfraNodeData): ServerInventoryItem[] => {
  const servers = data.servers ?? [];
  if (data.server && !servers.some((server) => server.id === data.server?.id)) {
    return [...servers, data.server];
  }
  return servers;
};

export const InfraNode = memo(({ data, selected }: NodeProps<InfraNodeData>) => {
  const Icon = iconByKind[data.kind] ?? Globe2;
  const servers = assignedServers(data);
  const logicalSubtitle = data.logicalSubtitle ?? data.subtitle;
  const visibleServers = servers.slice(0, 2);
  const hiddenCount = Math.max(servers.length - visibleServers.length, 0);

  return (
    <div
      className={`infraNode ${data.kind} ${data.risk ?? "normal"} ${selected ? "selected" : ""} ${
        servers.length > 0 ? "hasServers" : ""
      }`}
      data-zone-id={data.zoneId}
    >
      <Handle className="nodeHandle nodeHandleLeft" type="target" position={Position.Left} />
      <Handle className="nodeHandle nodeHandleTop" type="target" position={Position.Top} />
      <div className="nodeIcon">
        <Icon size={16} />
      </div>
      <div className="nodeText">
        <strong>{data.label}</strong>
        {logicalSubtitle ? <span>{logicalSubtitle}</span> : null}
        {servers.length > 0 ? (
          <div className="nodeServerList">
            {visibleServers.map((server) => (
              <div className="nodeServerChip" key={server.id} title={server.serverName}>
                <Server size={12} />
                <span>{server.serverName}</span>
              </div>
            ))}
            {hiddenCount > 0 ? <div className="nodeServerMore">+{hiddenCount}</div> : null}
          </div>
        ) : null}
      </div>
      <Handle className="nodeHandle nodeHandleRight" type="source" position={Position.Right} />
      <Handle className="nodeHandle nodeHandleBottom" type="source" position={Position.Bottom} />
    </div>
  );
});

export const ZoneNode = memo(({ data, selected }: NodeProps<InfraNodeData>) => (
  <div className={`zoneNode ${selected ? "selected" : ""}`}>
    <strong>{data.label}</strong>
    <span>{data.subtitle}</span>
  </div>
));

export const nodeTypes = {
  infraNode: InfraNode,
  zoneNode: ZoneNode,
};
