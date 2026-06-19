import { Pencil, Trash2 } from "lucide-react";
import type { Edge } from "reactflow";

type EdgeContextMenuProps = {
  menu:
    | {
        edge: Edge;
        x: number;
        y: number;
      }
    | null;
  onClose: () => void;
  onDelete: (edgeId: string) => void;
  onEdit: (edge: Edge) => void;
};

export function EdgeContextMenu({ menu, onClose, onDelete, onEdit }: EdgeContextMenuProps) {
  if (!menu) return null;

  const left = Math.min(menu.x, window.innerWidth - 220);
  const top = Math.min(menu.y, window.innerHeight - 130);
  const title = String(menu.edge.label ?? menu.edge.data?.connectionType ?? "Connection");

  return (
    <div className="contextMenuBackdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="nodeContextMenu"
        role="menu"
        style={{ left, top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="contextMenuTitle">{title}</div>
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            onEdit(menu.edge);
            onClose();
          }}
        >
          <Pencil size={15} />
          수정
        </button>
        <button
          className="dangerMenuItem"
          role="menuitem"
          type="button"
          onClick={() => {
            onDelete(menu.edge.id);
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
