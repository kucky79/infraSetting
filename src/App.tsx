import { Braces, Database, KeyRound, Layers, Maximize2, Network, RotateCcw, Upload, Wind } from "lucide-react";
import { CirclePlus, Download, FileDown, FileText, ImageDown, ScanSearch, WandSparkles, Workflow, Wrench } from "lucide-react";
import { Server } from "lucide-react";
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Maximize,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import { EdgeContextMenu } from "./components/EdgeContextMenu";
import { EdgeEditDialog } from "./components/EdgeEditDialog";
import { InfraCanvas } from "./components/InfraCanvas";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { NodeDetailDialog } from "./components/NodeDetailDialogV3";
import { NodeEditDialog } from "./components/NodeEditDialogV4";
import { ServerInventoryPanel } from "./components/ServerInventoryPanelV3";
import { ValidationPanel } from "./components/ValidationPanel";
import { exportDiagramImage, exportDiagramMermaid, exportDiagramPdf } from "./export/diagramExport";
import { createTobeModel } from "./flow/tobeModel";
import { useInfraStore } from "./store/infraStoreV4";
import type { InfraNodeData, ServerInventoryFile, ServerInventoryItem } from "./types/infra";

const PLAN_STORAGE_KEY = "infra-setting-plan";
const TOBE_LAYOUT_VERSION = "tobe-layout-v7";

const nodePresets: Array<{
  label: string;
  nodeLabel: string;
  kind: InfraNodeData["kind"];
  icon: typeof Braces;
}> = [
  { label: "API", nodeLabel: "New API", kind: "service", icon: Braces },
  { label: "DB", nodeLabel: "New DB", kind: "db", icon: Database },
  { label: "Gateway", nodeLabel: "New Gateway", kind: "gateway", icon: Network },
  { label: "Secrets", nodeLabel: "New Secrets", kind: "secrets", icon: KeyRound },
  { label: "Batch", nodeLabel: "New Batch", kind: "batch", icon: Workflow },
];

const networkZones = new Set(["dmz", "private", "external", "unknown"]);

const serverExcelColumns = [
  "No",
  "서버명",
  "시스템명",
  "역할/구분",
  "OS",
  "IP",
  "스펙",
  "가용존",
  "분류",
  "비고",
  "삭제예정",
  "네트워크영역",
  "공인IP",
] as const;

const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const toText = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const toIpList = (value: unknown) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  return [];
};

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["true", "y", "yes", "1", "예", "대상", "삭제예정"].includes(text);
};

const inferNetworkZone = (ips: string[]): ServerInventoryItem["networkZone"] => {
  if (ips.some((ip) => ip.startsWith("192.168."))) return "dmz";
  if (ips.some((ip) => ip.startsWith("172.16.") || ip.startsWith("172.20.") || ip.startsWith("10."))) return "private";
  return "unknown";
};

const inferHasPublicIp = (ips: string[]) => {
  return ips.some((ip) => {
    const privateIp =
      ip.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip.startsWith("192.168.");
    return !privateIp;
  });
};

const normalizeServerItem = (value: unknown, index: number): ServerInventoryItem => {
  const item = typeof value === "object" && value !== null ? (value as Partial<ServerInventoryItem>) : {};
  const serverName = toText(item.serverName, `server-${index + 1}`);
  const networkZone = networkZones.has(String(item.networkZone)) ? (item.networkZone as ServerInventoryItem["networkZone"]) : "unknown";

  return {
    id: toText(item.id, `server-${serverName}-${index + 1}`),
    no: typeof item.no === "number" ? item.no : index + 1,
    serverName,
    systemName: toText(item.systemName, "미분류"),
    role: toText(item.role, "unknown"),
    os: toText(item.os, ""),
    ips: toIpList(item.ips),
    spec: toText(item.spec, ""),
    availabilityZone: toText(item.availabilityZone, ""),
    team: toText(item.team, ""),
    note: toText(item.note, ""),
    deletePlanned: toBoolean(item.deletePlanned),
    networkZone,
    hasPublicIp: toBoolean(item.hasPublicIp),
  };
};

const serverTemplateRows = [
  {
    No: 1,
    서버명: "sample-web01",
    시스템명: "Sample",
    "역할/구분": "WEB",
    OS: "Ubuntu 22.04",
    IP: "10.0.0.10, 10.0.0.11",
    스펙: "2vCPU / 4GB",
    가용존: "zone-a",
    분류: "platform",
    비고: "template row",
    삭제예정: "N",
    네트워크영역: "private",
    공인IP: "N",
  },
];

const serverToExcelRow = (server: ServerInventoryItem) => ({
  No: server.no,
  서버명: server.serverName,
  시스템명: server.systemName,
  "역할/구분": server.role,
  OS: server.os,
  IP: server.ips.join(", "),
  스펙: server.spec,
  가용존: server.availabilityZone,
  분류: server.team,
  비고: server.note,
  삭제예정: server.deletePlanned ? "Y" : "N",
  네트워크영역: server.networkZone,
  공인IP: server.hasPublicIp ? "Y" : "N",
});

const rowValue = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
};

const excelRowToServer = (row: Record<string, unknown>, index: number): ServerInventoryItem => {
  const ips = toIpList(rowValue(row, "IP", "ips", "ip"));
  const networkZoneValue = String(rowValue(row, "네트워크영역", "networkZone")).trim();
  const networkZone = networkZones.has(networkZoneValue)
    ? (networkZoneValue as ServerInventoryItem["networkZone"])
    : inferNetworkZone(ips);
  const hasPublicIpValue = rowValue(row, "공인IP", "hasPublicIp");
  const serverName = toText(rowValue(row, "서버명", "serverName"), `server-${index + 1}`);

  return {
    id: toText(rowValue(row, "id"), `server-${serverName}-${index + 1}`),
    no: Number(rowValue(row, "No", "no")) || index + 1,
    serverName,
    systemName: toText(rowValue(row, "시스템명", "systemName"), "미분류"),
    role: toText(rowValue(row, "역할/구분", "role"), "unknown"),
    os: toText(rowValue(row, "OS", "os")),
    ips,
    spec: toText(rowValue(row, "스펙", "spec")),
    availabilityZone: toText(rowValue(row, "가용존", "availabilityZone")),
    team: toText(rowValue(row, "분류", "team")),
    note: toText(rowValue(row, "비고", "note")),
    deletePlanned: toBoolean(rowValue(row, "삭제예정", "deletePlanned")),
    networkZone,
    hasPublicIp: hasPublicIpValue === "" ? inferHasPublicIp(ips) : toBoolean(hasPublicIpValue),
  };
};

const downloadExcel = async (filename: string, rows: Record<string, unknown>[]) => {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...serverExcelColumns] });
  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 34 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "서버목록");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

function App() {
  const [servers, setServers] = useState<ServerInventoryItem[]>([]);
  const [inventorySource, setInventorySource] = useState("servers.json");
  const [fitViewVersion, setFitViewVersion] = useState(0);
  const [detailNode, setDetailNode] = useState<Node<InfraNodeData> | null>(null);
  const [editNode, setEditNode] = useState<Node<InfraNodeData> | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    node: Node<InfraNodeData>;
    x: number;
    y: number;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edge: Edge;
    x: number;
    y: number;
  } | null>(null);
  const [editEdge, setEditEdge] = useState<Edge | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverFileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDetailsElement>(null);
  const toolMenuRef = useRef<HTMLDetailsElement>(null);
  const diagramMenuRef = useRef<HTMLDetailsElement>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const serverMenuRef = useRef<HTMLDetailsElement>(null);
  const {
    nodes,
    edges,
    selectedNode,
    selectedNodeIds,
    setGraph,
    setSelectedNode,
    addServerNode,
    attachServerToNode,
    addServiceNode,
    addZone,
    updateNode,
    alignSelectedNodes,
    distributeSelectedNodes,
    resizeSelectedNodes,
    optimizeSelectedZones,
    updateEdge,
    removeEdge,
    removeNode,
    removeServer,
  } = useInfraStore();

  useEffect(() => {
    fetch("/data/servers.json")
      .then((response) => response.json())
      .then((data: ServerInventoryFile) => {
        setServers(data.servers);
        setInventorySource(data.source);
      })
      .catch(() => setServers([]));
  }, []);

  useEffect(() => {
    const savedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
    if (savedPlan) {
      const plan = JSON.parse(savedPlan);
      if (
        plan.modelVersion === TOBE_LAYOUT_VERSION &&
        Array.isArray(plan.nodes) &&
        plan.nodes.length > 0
      ) {
        setGraph(plan.nodes, plan.edges);
        return;
      }
    }
    const tobeModel = createTobeModel();
    setGraph(tobeModel.nodes, tobeModel.edges);
    setFitViewVersion((version) => version + 1);
  }, [setGraph]);

  useEffect(() => {
    if (nodes.length === 0) return;
    localStorage.setItem(
      PLAN_STORAGE_KEY,
      JSON.stringify({
        version: "1.0",
        name: "local-draft",
        modelVersion: TOBE_LAYOUT_VERSION,
        updatedAt: new Date().toISOString(),
        nodes,
        edges,
      }),
    );
  }, [nodes, edges]);

  const usedServerIds = useMemo(() => {
    return new Set(
      nodes.flatMap((node) => {
        const ids = node.data.servers?.map((server) => server.id) ?? [];
        if (node.data.server?.id && !ids.includes(node.data.server.id)) ids.push(node.data.server.id);
        return ids;
      }),
    );
  }, [nodes]);

  const assignmentTarget = useMemo(() => {
    if (!selectedNode || selectedNode.type === "zoneNode") return null;
    return selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    const handleEdgeContextMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ edgeId?: string; x?: number; y?: number }>).detail;
      const edge = edges.find((item) => item.id === detail?.edgeId);
      if (!edge || detail?.x === undefined || detail?.y === undefined) return;
      setContextMenu(null);
      setEdgeContextMenu({ edge, x: detail.x, y: detail.y });
    };

    window.addEventListener("infra-edge-context-menu", handleEdgeContextMenu);
    return () => window.removeEventListener("infra-edge-context-menu", handleEdgeContextMenu);
  }, [edges]);

  useEffect(() => {
    const closeMenus = () => {
      addMenuRef.current?.removeAttribute("open");
      toolMenuRef.current?.removeAttribute("open");
      diagramMenuRef.current?.removeAttribute("open");
      exportMenuRef.current?.removeAttribute("open");
      serverMenuRef.current?.removeAttribute("open");
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as globalThis.Node;
      if (
        addMenuRef.current?.contains(target) ||
        toolMenuRef.current?.contains(target) ||
        diagramMenuRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target) ||
        serverMenuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleDropServer = useCallback(
    (server: ServerInventoryItem) => {
      if (assignmentTarget) {
        attachServerToNode(assignmentTarget.id, server);
        return;
      }
      addServerNode(server);
    },
    [addServerNode, assignmentTarget, attachServerToNode],
  );

  const applyTobeModel = useCallback(() => {
    const tobeModel = createTobeModel();
    setGraph(tobeModel.nodes, tobeModel.edges);
    setDetailNode(null);
    setSelectedNode(null);
    setFitViewVersion((version) => version + 1);
  }, [setGraph, setSelectedNode]);

  const fitCanvas = useCallback(() => {
    setFitViewVersion((version) => version + 1);
  }, []);

  const exportPlan = useCallback(() => {
    downloadJson("infra-plan-tobe.json", {
      version: "1.0",
      name: "infra-plan-tobe",
      updatedAt: new Date().toISOString(),
      modelVersion: TOBE_LAYOUT_VERSION,
      nodes,
      edges,
    });
  }, [nodes, edges]);

  const importPlan = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const plan = JSON.parse(String(reader.result));
        setGraph(plan.nodes ?? [], plan.edges ?? []);
      };
      reader.readAsText(file, "utf-8");
    },
    [setGraph],
  );

  const exportServerList = useCallback(() => {
    downloadExcel("server-list.xlsx", servers.map(serverToExcelRow));
  }, [servers]);

  const downloadServerTemplate = useCallback(() => {
    downloadExcel("server-list-template.xlsx", serverTemplateRows);
  }, []);

  const importServerList = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(reader.result, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          window.alert("서버 리스트 Excel에 시트가 없습니다.");
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false,
        });
        const nextServers = rows
          .filter((row) => String(rowValue(row, "서버명", "serverName")).trim())
          .map((row, index) => excelRowToServer(row, index));
        if (nextServers.length === 0) {
          window.alert("서버명이 입력된 행이 없습니다.");
          return;
        }
        setServers(nextServers);
        setInventorySource(file.name);
      } catch {
        window.alert("서버 리스트 Excel을 읽을 수 없습니다.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleNodeSelect = useCallback(
    (node: Node<InfraNodeData> | null) => {
      setSelectedNode(node);
      setContextMenu(null);
      setEdgeContextMenu(null);
    },
    [setSelectedNode],
  );

  const handleNodeContextMenu = useCallback(
    (node: Node<InfraNodeData>, position: { x: number; y: number }) => {
      setSelectedNode(node);
      setContextMenu({ node, ...position });
      setEdgeContextMenu(null);
    },
    [setSelectedNode],
  );

  return (
    <div className="appShell">
      <header className="topBar">
        <div>
          <h1>Infra Setting Planner</h1>
          <span>{inventorySource} 기반 인프라 구성도</span>
        </div>
        <div className="topActions">
          <div className="mainActionRow">
            <button className="zoneToolButton" type="button" onClick={fitCanvas}>
              <ScanSearch size={16} />
              화면 맞춤
            </button>
            <button
              className="zoneToolButton"
              type="button"
              onClick={optimizeSelectedZones}
              title="영역을 내부 노드 기준으로 최적화"
            >
              <WandSparkles size={16} />
              최적화
            </button>
          </div>
          <details
            className="topToolMenu topAddMenu"
            ref={addMenuRef}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                toolMenuRef.current?.removeAttribute("open");
                diagramMenuRef.current?.removeAttribute("open");
                exportMenuRef.current?.removeAttribute("open");
                serverMenuRef.current?.removeAttribute("open");
              }
            }}
          >
            <summary className="toolMenuButton">
              <CirclePlus size={16} />
              추가
            </summary>
            <div className="toolMenuPanel addMenuPanel">
              <div className="actionGroup nodeAddGroup">
                <span className="actionGroupLabel">객체 추가</span>
                <div className="actionButtonRow">
                  <button className="nodeAddButton" type="button" onClick={addZone}>
                    <Layers size={16} />
                    영역
                  </button>
                  {nodePresets.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        className="nodeAddButton"
                        key={preset.label}
                        type="button"
                        onClick={() => addServiceNode(preset.nodeLabel, preset.kind)}
                      >
                        <Icon size={16} />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </details>
          <details
            className="topToolMenu"
            ref={toolMenuRef}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                addMenuRef.current?.removeAttribute("open");
                diagramMenuRef.current?.removeAttribute("open");
                exportMenuRef.current?.removeAttribute("open");
                serverMenuRef.current?.removeAttribute("open");
              }
            }}
          >
            <summary className="toolMenuButton">
              <Wrench size={16} />
              도구
            </summary>
            <div className="toolMenuPanel">
              <div className="actionGroup selectionToolGroup">
                <span className="actionGroupLabel">선택 도구 · {selectedNodeIds.length}개</span>
                <div className="actionButtonRow">
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 2}
                    type="button"
                    onClick={() => alignSelectedNodes("left")}
                    title="선택 노드 좌측 정렬"
                  >
                    <AlignHorizontalJustifyStart size={16} />
                    좌
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 2}
                    type="button"
                    onClick={() => alignSelectedNodes("top")}
                    title="선택 노드 상단 정렬"
                  >
                    <AlignVerticalJustifyStart size={16} />
                    상
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 3}
                    type="button"
                    onClick={() => distributeSelectedNodes("horizontal")}
                    title="가로 간격 균등"
                  >
                    <AlignHorizontalSpaceBetween size={16} />
                    가로
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 3}
                    type="button"
                    onClick={() => distributeSelectedNodes("vertical")}
                    title="세로 간격 균등"
                  >
                    <AlignVerticalSpaceBetween size={16} />
                    세로
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 2}
                    type="button"
                    onClick={() => resizeSelectedNodes("width")}
                    title="너비 통일"
                  >
                    <MoveHorizontal size={16} />
                    W
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 2}
                    type="button"
                    onClick={() => resizeSelectedNodes("height")}
                    title="높이 통일"
                  >
                    <MoveVertical size={16} />
                    H
                  </button>
                  <button
                    className="selectionToolButton"
                    disabled={selectedNodeIds.length < 2}
                    type="button"
                    onClick={() => resizeSelectedNodes("both")}
                    title="너비/높이 통일"
                  >
                    <Maximize size={16} />
                    W/H
                  </button>
                </div>
              </div>
            </div>
          </details>
          <details
            className="topToolMenu"
            ref={diagramMenuRef}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                addMenuRef.current?.removeAttribute("open");
                toolMenuRef.current?.removeAttribute("open");
                exportMenuRef.current?.removeAttribute("open");
                serverMenuRef.current?.removeAttribute("open");
              }
            }}
          >
            <summary className="toolMenuButton">
              <FileText size={16} />
              구성도
            </summary>
            <div className="toolMenuPanel compactMenuPanel">
              <div className="actionGroup">
                <span className="actionGroupLabel">JSON</span>
                <div className="actionButtonRow">
                  <button title="구성도 JSON 다운로드" type="button" onClick={exportPlan}>
                    <Download size={17} />
                    다운로드
                  </button>
                  <button
                    title="구성도 JSON 업로드"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={17} />
                    업로드
                  </button>
                </div>
              </div>
            </div>
          </details>
          <details
            className="topToolMenu"
            ref={serverMenuRef}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                addMenuRef.current?.removeAttribute("open");
                toolMenuRef.current?.removeAttribute("open");
                diagramMenuRef.current?.removeAttribute("open");
                exportMenuRef.current?.removeAttribute("open");
              }
            }}
          >
            <summary className="toolMenuButton">
              <Server size={16} />
              서버
            </summary>
            <div className="toolMenuPanel compactMenuPanel">
              <div className="actionGroup">
                <span className="actionGroupLabel">서버 리스트</span>
                <div className="actionButtonRow">
                  <button title="서버 리스트 Excel 다운로드" type="button" onClick={exportServerList}>
                    <Download size={17} />
                    다운로드
                  </button>
                  <button
                    title="서버 리스트 Excel 업로드"
                    type="button"
                    onClick={() => serverFileInputRef.current?.click()}
                  >
                    <Upload size={17} />
                    업로드
                  </button>
                  <button title="서버 리스트 Excel 양식 다운로드" type="button" onClick={downloadServerTemplate}>
                    <FileText size={17} />
                    양식
                  </button>
                </div>
              </div>
            </div>
          </details>
          <details
            className="topToolMenu"
            ref={exportMenuRef}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                addMenuRef.current?.removeAttribute("open");
                toolMenuRef.current?.removeAttribute("open");
                diagramMenuRef.current?.removeAttribute("open");
                serverMenuRef.current?.removeAttribute("open");
              }
            }}
          >
            <summary className="toolMenuButton">
              <FileDown size={16} />
              내보내기
            </summary>
            <div className="toolMenuPanel compactMenuPanel">
              <div className="actionGroup">
                <span className="actionGroupLabel">파일 형식</span>
                <div className="actionButtonRow">
                  <button title="이미지 PNG 내보내기" type="button" onClick={() => exportDiagramImage(nodes, edges)}>
                    <ImageDown size={17} />
                    이미지
                  </button>
                  <button title="Mermaid chart 내보내기" type="button" onClick={() => exportDiagramMermaid(nodes, edges)}>
                    <FileText size={17} />
                    Mermaid
                  </button>
                  <button title="PDF 내보내기" type="button" onClick={() => exportDiagramPdf(nodes, edges)}>
                    <FileDown size={17} />
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </details>
          <input
            ref={fileInputRef}
            className="hiddenInput"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPlan(file);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={serverFileInputRef}
            className="hiddenInput"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importServerList(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <main className="workspace">
        <ServerInventoryPanel
          servers={servers}
          assignmentTargetLabel={assignmentTarget?.data.label}
          usedServerIds={usedServerIds}
          onAddServer={handleDropServer}
          onRemoveServer={(serverId) => {
            removeServer(serverId);
            setDetailNode(null);
          }}
        />
        <section className="canvasStage">
          <InfraCanvas
            fitViewVersion={fitViewVersion}
            onNodeContextMenu={handleNodeContextMenu}
            onNodeSelect={handleNodeSelect}
          />
          <div className="validationOverlay">
            <ValidationPanel nodes={nodes} edges={edges} />
          </div>
        </section>
        <NodeContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onDelete={(nodeId) => {
            removeNode(nodeId);
            setContextMenu(null);
            setDetailNode(null);
            setEditNode(null);
            setSelectedNode(null);
          }}
          onEdit={(node) => setEditNode(node)}
          onOpenDetail={(node) => setDetailNode(node)}
          onRemoveServer={(serverId) => {
            removeServer(serverId);
            setContextMenu(null);
          }}
        />
        <EdgeContextMenu
          menu={edgeContextMenu}
          onClose={() => setEdgeContextMenu(null)}
          onDelete={(edgeId) => {
            removeEdge(edgeId);
            setEdgeContextMenu(null);
            setEditEdge(null);
          }}
          onEdit={(edge) => setEditEdge(edge)}
        />
        <NodeDetailDialog
          node={detailNode}
          onClose={() => setDetailNode(null)}
          onRemoveServer={(serverId) => {
            removeServer(serverId);
            setDetailNode(null);
          }}
          onDelete={(nodeId) => {
            removeNode(nodeId);
            setDetailNode(null);
            setEditNode(null);
            setSelectedNode(null);
          }}
        />
        <NodeEditDialog
          node={editNode}
          onClose={() => setEditNode(null)}
          onSave={(nodeId, updates) => updateNode(nodeId, updates)}
        />
        <EdgeEditDialog
          edge={editEdge}
          onClose={() => setEditEdge(null)}
          onSave={(edgeId, updates) => updateEdge(edgeId, updates)}
        />
      </main>
    </div>
  );
}

export default App;


