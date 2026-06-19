import type { Edge, Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

const node = (
  id: string,
  x: number,
  y: number,
  label: string,
  kind: InfraNodeData["kind"],
  subtitle?: string,
  risk?: InfraNodeData["risk"],
): Node<InfraNodeData> => ({
  id,
  type: "infraNode",
  position: { x, y },
  zIndex: 10,
  data: { label, kind, subtitle, risk, zoneId: getDefaultZoneId(id) },
});

const getDefaultZoneId = (nodeId: string) => {
  if (nodeId.startsWith("client-")) return "zone-dmz";
  if (nodeId.startsWith("db-")) return "zone-db";
  if (nodeId.startsWith("mgmt-")) return "zone-mgmt";
  return "zone-private";
};

const zone = (
  id: string,
  x: number,
  y: number,
  label: string,
  subtitle: string,
  width: number,
  height: number,
): Node<InfraNodeData> => {
  const layoutById: Record<string, { x: number; y: number; width: number; height: number; subtitle?: string }> = {
    "zone-dmz": { x: 20, y: 40, width: 390, height: 620, subtitle: "192.168.0.0/24 · 외부 접근 가능" },
    "zone-private": { x: 450, y: 40, width: 540, height: 940, subtitle: "172.20.0.0/24 · 내부 전용 API/Batch" },
    "zone-db": { x: 1035, y: 430, width: 560, height: 420 },
    "zone-mgmt": { x: 20, y: 700, width: 390, height: 310, subtitle: "MOTR · HIWARE · Acronis · Petra" },
  };
  const layout = layoutById[id] ?? { x, y, width, height };
  return {
    id,
    type: "zoneNode",
    position: { x: layout.x, y: layout.y },
    selectable: false,
    draggable: false,
    zIndex: 0,
    data: { label, subtitle: layout.subtitle ?? subtitle, kind: "zone" },
    style: { width: layout.width, height: layout.height },
  };
};

const edge = (
  id: string,
  source: string,
  target: string,
  label: string,
  color: string,
  animated = false,
): Edge => ({
  id,
  source,
  target,
  label,
  animated,
  type: "smoothstep",
  zIndex: 5,
  style: { stroke: color, strokeWidth: 2 },
  labelStyle: { fill: color, fontSize: 11, fontWeight: 700 },
  labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
  labelBgPadding: [5, 3],
  labelBgBorderRadius: 4,
  data: { connectionType: label },
});

export const createTobeModel = () => {
  const nodes: Node<InfraNodeData>[] = [
    zone("zone-dmz", 20, 40, "DMZ VPC", "192.168.0.0/24 · 외부 접근 가능", 390, 940),
    zone("zone-private", 450, 40, "Private VPC", "172.20.0.0/24 · 내부 전용 API/DB/Batch", 1200, 940),
    zone("zone-db", 1035, 430, "DB Layer", "Private only", 560, 420),
    zone("zone-mgmt", 60, 690, "MGMT / Security", "MOTR · HIWARE · Acronis · Petra", 310, 310),

    node("client-pos", 90, 120, "POS", "client", "WinForms C#"),
    node("client-j-salon", 90, 195, "J-Salon", "client", "Vue + Pinia"),
    node("client-j-works", 90, 270, "J-Works", "client", "Vue + Pinia"),
    node("client-designer-app", 90, 345, "디자이너앱", "client", "Flutter"),
    node("client-customer-app", 90, 420, "고객앱", "client", "Flutter"),
    node("client-homepage", 90, 495, "Homepage", "client", "Java/JSP", "warning"),
    node("client-academy", 90, 570, "JUNO Academy", "client", "완전 독립 서비스"),

    node("gateway-juno-api", 500, 160, "JUNO API Gateway", "gateway", ":9000 · 외부 API 진입점"),
    node("api-login", 760, 100, "통합 Login-API", "service", "JWT 발급·검증 | Vault(JWT Key)"),
    node("api-permission", 760, 190, "Permission API", "service", "신규개발 | Login-API 연동"),
    node("vault", 1120, 145, "Vault", "secrets", "Secret 중앙 관리"),

    node("api-pos", 560, 305, "POS API", "service", "예약·오더·결제"),
    node("api-crm", 560, 380, "CRM API", "service", "고객 정보 관리"),
    node("api-hrm", 560, 455, "HRM API", "service", "인사·급여 관리"),
    node("api-checkin", 560, 530, "CheckIn API", "service", "QR 체크인 전용"),
    node("api-board", 560, 605, "Board API", "service", "게시판 백엔드"),
    node("report-server", 560, 680, "Report Server", "service", "OZ Report"),
    node("noti-api", 560, 755, "Noti API_Server", "service", "Kafka Consumer → Push/SMS/카카오"),
    node("kafka", 810, 380, "Kafka", "infra", "예약·결제·체크인 이벤트 브로커"),

    node("db-pos", 1085, 500, "POS DB", "db", "M/S HA 구성"),
    node("db-etl", 1330, 500, "ETL DB", "db", "분석/DW"),
    node("db-hrm", 1085, 590, "HRM DB", "db", "2vC/4MEM"),
    node("db-customer-app", 1330, 590, "고객앱 DB", "db", "4vC/8MEM"),
    node("db-bat", 1085, 680, "BAT DB", "db", "2vC/8MEM"),
    node("db-integrated-customer", 1330, 680, "통합고객 DB", "db", "통합고객 전용"),
    node("db-board", 1330, 770, "Board DB", "db", "게시판 전용"),

    node("batch-airflow", 805, 775, "AirFlow - Batch", "batch", "자정 배치 | J-Salon/J-Works DB R/W"),
    node("etl-airflow", 805, 865, "AirFlow - ETL", "batch", "POS/J-Salon DB → 분석 DB"),
    node("jenkins", 505, 865, "Jenkins", "infra", "CI/CD | Vault AppRole"),
    node("mgmt-motr", 90, 745, "MOTR 서버", "server", "4vC/8MEM HDD20GB"),
    node("mgmt-hiware", 90, 805, "HIWARE", "server", "시스템 접근제어"),
    node("mgmt-acronis", 90, 865, "Acronis", "server", "백업관리"),
    node("mgmt-petra", 90, 925, "Petra", "server", "DB암호화관리"),
  ];

  const clients = [
    "client-pos",
    "client-j-salon",
    "client-j-works",
    "client-designer-app",
    "client-customer-app",
    "client-homepage",
  ];

  const edges: Edge[] = [
    ...clients.map((clientId) =>
      edge(`edge-${clientId}-gateway`, clientId, "gateway-juno-api", "REST", "#2563eb", true),
    ),
    edge("edge-gateway-login", "gateway-juno-api", "api-login", "REST", "#2563eb", true),
    edge("edge-gateway-permission", "gateway-juno-api", "api-permission", "REST", "#2563eb", true),
    edge("edge-gateway-pos", "gateway-juno-api", "api-pos", "REST", "#2563eb", true),
    edge("edge-gateway-crm", "gateway-juno-api", "api-crm", "REST", "#2563eb", true),
    edge("edge-gateway-hrm", "gateway-juno-api", "api-hrm", "REST", "#2563eb", true),
    edge("edge-gateway-checkin", "gateway-juno-api", "api-checkin", "REST", "#2563eb", true),
    edge("edge-gateway-board", "gateway-juno-api", "api-board", "REST", "#2563eb", true),
    edge("edge-gateway-report", "gateway-juno-api", "report-server", "REST", "#2563eb", true),

    edge("edge-login-vault", "api-login", "vault", "Vault", "#7c3aed"),
    edge("edge-permission-login", "api-permission", "api-login", "JWT", "#0f766e"),
    edge("edge-checkin-login", "api-checkin", "api-login", "JWT", "#0f766e"),
    edge("edge-board-login", "api-board", "api-login", "JWT", "#0f766e"),
    edge("edge-jenkins-vault", "jenkins", "vault", "Vault AppRole", "#7c3aed"),

    edge("edge-pos-kafka", "api-pos", "kafka", "Kafka publish", "#d97706", true),
    edge("edge-checkin-kafka", "api-checkin", "kafka", "Kafka publish", "#d97706", true),
    edge("edge-kafka-noti", "kafka", "noti-api", "Kafka consume", "#d97706", true),

    edge("edge-pos-db", "api-pos", "db-pos", "DB", "#64748b"),
    edge("edge-crm-db", "api-crm", "db-integrated-customer", "DB", "#64748b"),
    edge("edge-hrm-db", "api-hrm", "db-hrm", "DB", "#64748b"),
    edge("edge-checkin-db", "api-checkin", "db-pos", "DB", "#64748b"),
    edge("edge-board-db", "api-board", "db-board", "DB", "#64748b"),
    edge("edge-batch-db", "batch-airflow", "db-pos", "DB R/W", "#64748b"),
    edge("edge-etl-db", "etl-airflow", "db-etl", "ETL", "#64748b"),
  ];

  return { nodes, edges };
};
