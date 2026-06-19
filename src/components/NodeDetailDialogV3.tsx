import { Trash2, X } from "lucide-react";
import { useEffect } from "react";
import type { Node } from "reactflow";
import type { InfraNodeData, ServerInventoryItem } from "../types/infra";

type NodeDetailDialogProps = {
  node: Node<InfraNodeData> | null;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onRemoveServer: (serverId: string) => void;
};

const getAssignedServers = (node: Node<InfraNodeData>): ServerInventoryItem[] => {
  const servers = node.data.servers ?? [];
  if (node.data.server && !servers.some((server) => server.id === node.data.server?.id)) {
    return [...servers, node.data.server];
  }
  return servers;
};

export function NodeDetailDialog({ node, onClose, onDelete, onRemoveServer }: NodeDetailDialogProps) {
  useEffect(() => {
    if (!node) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [node, onClose]);

  if (!node) return null;

  const assignedServers = getAssignedServers(node);
  const isStandaloneServerNode = assignedServers.length === 1 && node.id === assignedServers[0].id;

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        aria-labelledby="node-detail-title"
        className="nodeDialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialogHeader">
          <div>
            <h2 id="node-detail-title">상세 정보</h2>
            <strong>{node.data.label}</strong>
            <span>{node.data.kind}</span>
          </div>
          <button aria-label="닫기" className="iconButton" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {assignedServers.length > 0 ? (
          <div className="assignedServerList">
            <span className="sectionLabel">
              {isStandaloneServerNode ? "서버 정보" : `할당된 서버 ${assignedServers.length}대`}
            </span>
            {assignedServers.map((server) => (
              <article className="assignedServerCard" key={server.id}>
                <div>
                  <strong>{server.serverName}</strong>
                  <span>
                    {server.systemName} · {server.role} · {server.availabilityZone}
                  </span>
                  <small>{server.ips.join(", ")}</small>
                </div>
                {!isStandaloneServerNode ? (
                  <button
                    className="smallDangerButton"
                    type="button"
                    onClick={() => onRemoveServer(server.id)}
                  >
                    해제
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="logicalDetail">
            <span>설명</span>
            <p>{node.data.subtitle || "논리 구성 요소"}</p>
          </div>
        )}

        {assignedServers.length === 1 ? (
          <dl className="detailList dialogDetailList">
            <dt>시스템</dt>
            <dd>{assignedServers[0].systemName}</dd>
            <dt>역할</dt>
            <dd>{assignedServers[0].role}</dd>
            <dt>OS</dt>
            <dd>{assignedServers[0].os}</dd>
            <dt>스펙</dt>
            <dd>{assignedServers[0].spec}</dd>
            <dt>분류</dt>
            <dd>{assignedServers[0].team}</dd>
            <dt>망 추정</dt>
            <dd>{assignedServers[0].networkZone}</dd>
            <dt>비고</dt>
            <dd>{assignedServers[0].note || "-"}</dd>
          </dl>
        ) : null}

        <footer className="dialogActions">
          <button className="dangerButton" type="button" onClick={() => onDelete(node.id)}>
            <Trash2 size={16} />
            캔버스에서 노드 삭제
          </button>
        </footer>
      </section>
    </div>
  );
}
