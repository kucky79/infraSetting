import { Save, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Edge } from "reactflow";

type EdgeUpdates = {
  label: string;
  connectionType: string;
  color: string;
  animated: boolean;
};

type EdgeEditDialogProps = {
  edge: Edge | null;
  onClose: () => void;
  onSave: (edgeId: string, updates: EdgeUpdates) => void;
};

const edgeTypeOptions = [
  { value: "REST", label: "REST", description: "HTTP/API 호출", color: "#2563eb" },
  { value: "DB", label: "DB", description: "Database read/write", color: "#64748b" },
  { value: "Kafka", label: "Kafka", description: "이벤트 publish/consume", color: "#d97706" },
  { value: "Vault", label: "Vault", description: "Secret 또는 인증 정보", color: "#7c3aed" },
  { value: "JWT", label: "JWT", description: "토큰 발급/검증", color: "#0f766e" },
  { value: "ETL", label: "ETL", description: "배치/분석 데이터 흐름", color: "#0891b2" },
  { value: "Custom", label: "Custom", description: "직접 정의", color: "#334155" },
] as const;

export function EdgeEditDialog({ edge, onClose, onSave }: EdgeEditDialogProps) {
  const [label, setLabel] = useState("");
  const [connectionType, setConnectionType] = useState("REST");
  const [color, setColor] = useState("#2563eb");
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    if (!edge) return;
    const edgeStyle = edge.style as { stroke?: string } | undefined;
    const nextLabel = String(edge.label ?? edge.data?.connectionType ?? "REST");
    setLabel(nextLabel);
    setConnectionType(String(edge.data?.connectionType ?? nextLabel));
    setColor(edgeStyle?.stroke ?? "#2563eb");
    setAnimated(Boolean(edge.animated));
  }, [edge]);

  useEffect(() => {
    if (!edge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [edge, onClose]);

  const selectedType = useMemo(
    () => edgeTypeOptions.find((option) => option.value === connectionType) ?? edgeTypeOptions[0],
    [connectionType],
  );

  if (!edge) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextLabel = label.trim() || connectionType;
    onSave(edge.id, {
      label: nextLabel,
      connectionType,
      color,
      animated,
    });
    onClose();
  };

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-modal="true"
        aria-labelledby="edge-edit-title"
        className="nodeDialog nodeEditDialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="dialogHeader">
          <div>
            <h2 id="edge-edit-title">연결선 수정</h2>
            <strong>{label || "Connection"}</strong>
            <span>{selectedType.label}</span>
          </div>
          <button aria-label="닫기" className="iconButton" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="editFormGrid">
          <label className="fieldLabel">
            <span>텍스트</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label className="fieldLabel">
            <span>색상</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
        </div>

        <div className="nodeKindSelector">
          <span className="sectionLabel">라인 유형</span>
          <div className="nodeKindGrid">
            {edgeTypeOptions.map((option) => (
              <button
                className={`nodeKindOption ${connectionType === option.value ? "selected" : ""}`}
                key={option.value}
                type="button"
                onClick={() => {
                  setConnectionType(option.value);
                  setLabel(option.label);
                  setColor(option.color);
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="toggleLine edgeAnimatedToggle">
          <input checked={animated} type="checkbox" onChange={(event) => setAnimated(event.target.checked)} />
          라인 애니메이션 사용
        </label>

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
