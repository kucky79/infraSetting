import { Database, Search, Server, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ServerInventoryItem } from "../types/infra";

type ServerInventoryPanelProps = {
  servers: ServerInventoryItem[];
  assignmentTargetLabel?: string;
  usedServerIds: Set<string>;
  onAddServer: (server: ServerInventoryItem) => void;
  onRemoveServer: (serverId: string) => void;
};

const ALL = "전체";

export function ServerInventoryPanel({
  servers,
  assignmentTargetLabel,
  usedServerIds,
  onAddServer,
  onRemoveServer,
}: ServerInventoryPanelProps) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [hideDeleted, setHideDeleted] = useState(true);

  const systems = useMemo(
    () => [ALL, ...Array.from(new Set(servers.map((server) => server.systemName).filter(Boolean))).sort()],
    [servers],
  );
  const roles = useMemo(
    () => [ALL, ...Array.from(new Set(servers.map((server) => server.role).filter(Boolean))).sort()],
    [servers],
  );

  const filteredServers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return servers.filter((server) => {
      if (hideDeleted && server.deletePlanned) return false;
      if (system !== ALL && server.systemName !== system) return false;
      if (role !== ALL && server.role !== role) return false;
      if (!normalized) return true;
      return [server.serverName, server.systemName, server.role, server.os, server.ips.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [hideDeleted, query, role, servers, system]);

  return (
    <aside className="inventoryPanel">
      <div className="panelHeader">
        <h2>서버 리스트</h2>
        <span>
          {filteredServers.length} / {servers.length}
        </span>
      </div>

      {assignmentTargetLabel ? (
        <div className="assignmentHint">
          <strong>{assignmentTargetLabel}</strong>
          <span>서버 카드를 클릭하면 선택한 TOBE 노드에 할당됩니다.</span>
        </div>
      ) : null}

      <label className="searchBox">
        <Search size={16} />
        <input
          value={query}
          placeholder="서버명, IP, OS 검색"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="filterGrid">
        <select aria-label="시스템 필터" value={system} onChange={(event) => setSystem(event.target.value)}>
          {systems.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select aria-label="역할 필터" value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <label className="toggleLine">
        <input
          type="checkbox"
          checked={hideDeleted}
          onChange={(event) => setHideDeleted(event.target.checked)}
        />
        삭제예정 제외
      </label>

      <div className="serverList">
        {filteredServers.map((server) => {
          const isDb = server.role.toUpperCase().includes("DB");
          const Icon = isDb ? Database : Server;
          const used = usedServerIds.has(server.id);
          return (
            <button
              className={`serverCard ${used ? "used" : ""}`}
              key={server.id}
              type="button"
              onClick={() => {
                if (used) {
                  onRemoveServer(server.id);
                  return;
                }
                onAddServer(server);
              }}
            >
              <Icon size={16} />
              <div>
                <strong>{server.serverName}</strong>
                <span>
                  {server.systemName} · {server.role} · {server.availabilityZone}
                </span>
                <small>{server.ips.join(", ")}</small>
              </div>
              <span className={used ? "removeBadge" : "addBadge"}>
                {used ? "제거" : assignmentTargetLabel ? "할당" : "추가"}
              </span>
              {server.deletePlanned ? <Trash2 className="deleteIcon" size={14} /> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
