import { Trash2, X } from "lucide-react";
import { useEffect } from "react";
import type { Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

type NodeDetailDialogProps = {
  node: Node<InfraNodeData> | null;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
};

export function NodeDetailDialog({ node, onClose, onDelete }: NodeDetailDialogProps) {
  useEffect(() => {
    if (!node) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [node, onClose]);

  if (!node) return null;

  const server = node.data.server;
  const isAssignedServer = Boolean(server && node.id !== server.id);

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

        {server ? (
          <>
            {isAssignedServer ? (
              <div className="logicalDetail assignedServerSummary">
                <span>할당된 서버</span>
                <p>{server.serverName}</p>
              </div>
            ) : null}
            <dl className="detailList dialogDetailList">
              <dt>시스템</dt>
              <dd>{server.systemName}</dd>
              <dt>역할</dt>
              <dd>{server.role}</dd>
              <dt>OS</dt>
              <dd>{server.os}</dd>
              <dt>IP</dt>
              <dd>{server.ips.join(", ")}</dd>
              <dt>스펙</dt>
              <dd>{server.spec}</dd>
              <dt>가용존</dt>
              <dd>{server.availabilityZone}</dd>
              <dt>분류</dt>
              <dd>{server.team}</dd>
              <dt>망 추정</dt>
              <dd>{server.networkZone}</dd>
              <dt>비고</dt>
              <dd>{server.note || "-"}</dd>
            </dl>
          </>
        ) : (
          <div className="logicalDetail">
            <span>설명</span>
            <p>{node.data.subtitle || "논리 구성 요소"}</p>
          </div>
        )}

        <footer className="dialogActions">
          <button className="dangerButton" type="button" onClick={() => onDelete(node.id)}>
            <Trash2 size={16} />
            {isAssignedServer ? "서버 할당 해제" : "캔버스에서 삭제"}
          </button>
        </footer>
      </section>
    </div>
  );
}
