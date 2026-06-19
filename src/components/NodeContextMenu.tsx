import { Eye, Pencil, Trash2, Unlink } from "lucide-react";
import type { Node } from "reactflow";
import type { InfraNodeData, ServerInventoryItem } from "../types/infra";

type NodeContextMenuProps = {
  menu:
    | {
        node: Node<InfraNodeData>;
        x: number;
        y: number;
      }
    | null;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onEdit: (node: Node<InfraNodeData>) => void;
  onOpenDetail: (node: Node<InfraNodeData>) => void;
  onRemoveServer: (serverId: string) => void;
};

const assignedServers = (node: Node<InfraNodeData>): ServerInventoryItem[] => {
  const servers = node.data.servers ?? [];
  if (node.data.server && !servers.some((server) => server.id === node.data.server?.id)) {
    return [...servers, node.data.server];
  }
  return servers;
};

export function NodeContextMenu({
  menu,
  onClose,
  onDelete,
  onEdit,
  onOpenDetail,
  onRemoveServer,
}: NodeContextMenuProps) {
  if (!menu) return null;

  const servers = assignedServers(menu.node);
  const hasAssignedServers = servers.length > 0 && menu.node.id !== servers[0]?.id;
  const left = Math.min(menu.x, window.innerWidth - 220);
  const top = Math.min(menu.y, window.innerHeight - 150);

  return (
    <div className="contextMenuBackdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="nodeContextMenu"
        role="menu"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="contextMenuTitle">{menu.node.data.label}</div>
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            onEdit(menu.node);
            onClose();
          }}
        >
          <Pencil size={15} />
          수정
        </button>
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            onOpenDetail(menu.node);
            onClose();
          }}
        >
          <Eye size={15} />
          상세보기
        </button>
        {hasAssignedServers ? (
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              servers.forEach((server) => onRemoveServer(server.id));
              onClose();
            }}
          >
            <Unlink size={15} />
            서버 할당 해제
          </button>
        ) : null}
        <button
          className="dangerMenuItem"
          role="menuitem"
          type="button"
          onClick={() => {
            onDelete(menu.node.id);
            onClose();
          }}
        >
          <Trash2 size={15} />
          삭제
        </button>
      </div>
    </div>
  );
}
