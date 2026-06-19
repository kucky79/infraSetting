import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Edge, Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

type ValidationPanelProps = {
  nodes: Node<InfraNodeData>[];
  edges: Edge[];
};

export function ValidationPanel({ nodes, edges }: ValidationPanelProps) {
  const findings = nodes.flatMap((node) => {
    const servers = node.data.servers ?? (node.data.server ? [node.data.server] : []);
    return servers.flatMap((server) => {
      const messages: string[] = [];
      if (server.deletePlanned) {
        messages.push(`${server.serverName}: 삭제 예정 서버가 TOBE 구성에 포함됨`);
      }
      if (server.role.toUpperCase().includes("DB") && server.hasPublicIp) {
        messages.push(`${server.serverName}: DB 역할 서버에 공인 IP가 포함됨`);
      }
      if (server.hasPublicIp && server.networkZone === "private") {
        messages.push(`${server.serverName}: Private 영역 서버에 공인 IP가 포함됨`);
      }
      return messages;
    });
  });

  const isolatedNodes = nodes.filter(
    (node) =>
      node.type !== "zoneNode" &&
      node.data.kind !== "client" &&
      !edges.some((edge) => edge.source === node.id || edge.target === node.id),
  );
  const nodeCount = nodes.filter((node) => node.type !== "zoneNode").length;
  const hasFindings = findings.length > 0;

  return (
    <details className="validationPopover">
      <summary className={hasFindings ? "validationFab warning" : "validationFab"}>
        {hasFindings ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
        <span>검증</span>
        <strong>{hasFindings ? findings.length : "OK"}</strong>
      </summary>
      <section className="sidePanel validationPanel">
        <h2>검증</h2>
        {findings.length === 0 ? (
          <div className="statusOk">
            <CheckCircle2 size={16} />
            즉시 경고 항목 없음
          </div>
        ) : (
          <ul className="findingList">
            {findings.map((finding) => (
              <li key={finding}>
                <AlertTriangle size={14} />
                {finding}
              </li>
            ))}
          </ul>
        )}
        <div className="metricGrid">
          <div>
            <strong>{nodeCount}</strong>
            <span>노드</span>
          </div>
          <div>
            <strong>{edges.length}</strong>
            <span>연결</span>
          </div>
          <div>
            <strong>{isolatedNodes.length}</strong>
            <span>미연결</span>
          </div>
        </div>
      </section>
    </details>
  );
}
