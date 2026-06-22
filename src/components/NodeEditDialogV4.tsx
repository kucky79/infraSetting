import { Boxes, Braces, Database, KeyRound, Network, Save, Server, Smartphone, Workflow, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

type EditableNodeKind = Exclude<InfraNodeData["kind"], "zone">;

type NodeEditDialogProps = {
  node: Node<InfraNodeData> | null;
  onClose: () => void;
  onSave: (
    nodeId: string,
    updates: Pick<InfraNodeData, "label" | "kind" | "logicalSubtitle" | "subtitle" | "spec">,
  ) => void;
};

const nodeKindOptions: Array<{ value: EditableNodeKind; label: string; description: string }> = [
  { value: "service", label: "API", description: "업무 API, 백엔드 서비스" },
  { value: "db", label: "DB", description: "데이터베이스, 저장소" },
  { value: "gateway", label: "게이트웨이", description: "외부/내부 API 진입점" },
  { value: "secrets", label: "Secrets", description: "Vault, Key, Secret 관리" },
  { value: "airflow", label: "AirFlow", description: "DAG, Workflow, ETL orchestration" },
  { value: "batch", label: "Batch", description: "스케줄러, ETL, 배치" },
  { value: "server", label: "Server", description: "일반 서버/런타임" },
  { value: "infra", label: "Infra", description: "공통 인프라, 운영 도구" },
  { value: "client", label: "Client", description: "앱, 웹, POS 등 클라이언트" },
];

const defaultSubtitleByKind: Record<EditableNodeKind, string> = {
  service: "API",
  db: "DB",
  gateway: "Gateway",
  secrets: "Secrets",
  airflow: "AirFlow",
  batch: "Batch",
  server: "Server",
  infra: "Infra",
  client: "Client",
};

const iconByKind: Record<EditableNodeKind, typeof Braces> = {
  service: Braces,
  db: Database,
  gateway: Network,
  secrets: KeyRound,
  airflow: Workflow,
  batch: Workflow,
  server: Server,
  infra: Boxes,
  client: Smartphone,
};

const getEditableKind = (kind: InfraNodeData["kind"]): EditableNodeKind => {
  if (kind === "zone") return "service";
  if (kind === "airflow") return "batch";
  return kind;
};

function NodeKindIcon({ kind }: { kind: EditableNodeKind }) {
  const Icon = iconByKind[kind === "airflow" ? "batch" : kind];
  return (
    <span className="nodeKindIcon">
      <Icon size={16} />
    </span>
  );
}

export function NodeEditDialog({ node, onClose, onSave }: NodeEditDialogProps) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<EditableNodeKind>("service");
  const [subtitle, setSubtitle] = useState("");
  const [spec, setSpec] = useState("");

  useEffect(() => {
    if (!node) return;
    setLabel(node.data.label);
    setKind(getEditableKind(node.data.kind));
    setSubtitle(node.data.logicalSubtitle ?? node.data.subtitle ?? "");
    setSpec(node.data.spec ?? "");
  }, [node]);

  useEffect(() => {
    if (!node) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [node, onClose]);

  const selectedKind = useMemo(
    () => nodeKindOptions.find((option) => option.value === kind) ?? nodeKindOptions[0],
    [kind],
  );

  if (!node) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLabel = label.trim();
    const nextSubtitle = subtitle.trim() || defaultSubtitleByKind[kind];
    const nextSpec = spec.trim();
    if (!nextLabel) return;
    onSave(node.id, {
      label: nextLabel,
      kind,
      logicalSubtitle: nextSubtitle,
      subtitle: nextSubtitle,
      spec: nextSpec || undefined,
    });
    onClose();
  };

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-modal="true"
        aria-labelledby="node-edit-title"
        className="nodeDialog nodeEditDialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="dialogHeader">
          <div>
            <h2 id="node-edit-title">노드 수정</h2>
            <strong>{node.data.label}</strong>
            <span>{selectedKind.value === "gateway" ? "Gateway" : selectedKind.label}</span>
          </div>
          <button aria-label="닫기" className="iconButton" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="editFormGrid">
          <label className="fieldLabel">
            <span>노드 이름</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>

          <label className="fieldLabel">
            <span>설명</span>
            <input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
          </label>
          <label className="fieldLabel wideField">
            <span>스펙</span>
            <input
              placeholder="예: 4vC/8MEM, M/S HA 구성, ETL 전용"
              value={spec}
              onChange={(event) => setSpec(event.target.value)}
            />
          </label>
        </div>

        <div className="nodeKindSelector">
          <span className="sectionLabel">노드 유형</span>
          <div className="nodeKindGrid">
            {nodeKindOptions.filter((option) => option.value !== "airflow").map((option) => (
              <button
                className={`nodeKindOption ${kind === option.value ? "selected" : ""}`}
                key={option.value}
                type="button"
                onClick={() => {
                  setKind(option.value);
                  if (!subtitle.trim()) setSubtitle(defaultSubtitleByKind[option.value]);
                }}
              >
                <NodeKindIcon kind={option.value} />
                <strong>{option.value === "gateway" ? "Gateway" : option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="dialogActions">
          <button className="primaryButton" type="submit">
            <Save size={16} />
            저장
          </button>
        </footer>
      </form>
    </div>
  );
}
