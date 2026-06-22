import { Background, ConnectionMode, Controls, MiniMap } from "reactflow";
import ReactFlow from "reactflow";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { edgeTypes } from "../flow/edgeTypes";
import { nodeTypes } from "../flow/nodeTypes";
import { useInfraStore } from "../store/infraStoreV4";
import type { InfraNodeData } from "../types/infra";

type InfraCanvasProps = {
  fitViewVersion: number;
  onNodeContextMenu: (node: Node<InfraNodeData>, position: { x: number; y: number }) => void;
  onNodeSelect: (node: Node<InfraNodeData> | null) => void;
};

const getNodeSize = (
  node: Node<InfraNodeData>,
  sizeById: Map<string, { width: number; height: number }>,
) => {
  const measured = sizeById.get(node.id);
  const style = node.style as { width?: number; height?: number } | undefined;
  const styleWidth = Number(style?.width);
  const styleHeight = Number(style?.height);
  return {
    width: measured?.width ?? (Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : 220),
    height: measured?.height ?? (Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : 58),
  };
};

const getExpandedZoneStyle = (
  zone: Node<InfraNodeData>,
  nodes: Node<InfraNodeData>[],
  sizeById: Map<string, { width: number; height: number }>,
) => {
  const baseStyle = zone.style as { width?: number; height?: number } | undefined;
  const baseWidth = Number(baseStyle?.width) || 320;
  const baseHeight = Number(baseStyle?.height) || 240;
  const padding = 34;
  const zoneChildren: Record<string, (node: Node<InfraNodeData>) => boolean> = {
    "zone-dmz": (node) => node.id.startsWith("client-"),
    "zone-private": (node) =>
      node.id.startsWith("gateway-") ||
      node.id.startsWith("api-") ||
      node.id === "kafka" ||
      node.id === "vault" ||
      node.id === "jenkins" ||
      node.id.includes("airflow"),
    "zone-db": (node) => node.id.startsWith("db-"),
    "zone-mgmt": (node) => node.id.startsWith("mgmt-"),
  };

  const assignedChildren = nodes.filter((node) => node.type !== "zoneNode" && node.data.zoneId === zone.id);
  const children =
    assignedChildren.length > 0
      ? assignedChildren
      : nodes.filter((node) => node.type !== "zoneNode" && zoneChildren[zone.id]?.(node));

  if (children.length === 0) return zone.style;

  const zoneRight = zone.position.x + baseWidth;
  const zoneBottom = zone.position.y + baseHeight;
  const bounds = children.reduce(
    (current, child) => {
      const size = getNodeSize(child, sizeById);
      return {
        maxX: Math.max(current.maxX, child.position.x + size.width),
        maxY: Math.max(current.maxY, child.position.y + size.height),
      };
    },
    { maxX: zoneRight, maxY: zoneBottom },
  );

  const expandedWidth = Math.max(baseWidth, bounds.maxX - zone.position.x + padding);
  const expandedHeight = Math.max(baseHeight, bounds.maxY - zone.position.y + padding);
  const gap = 40;
  const fixedWidthZones = new Set(["zone-dmz", "zone-private", "zone-db", "zone-mgmt"]);
  const maxWidthByZone: Record<string, number> = {
    "zone-dmz": Math.max(baseWidth, 450 - gap - zone.position.x),
    "zone-private": Math.max(baseWidth, 1035 - gap - zone.position.x),
  };

  return {
    ...zone.style,
    width: fixedWidthZones.has(zone.id) ? baseWidth : Math.min(expandedWidth, maxWidthByZone[zone.id] ?? expandedWidth),
    height: expandedHeight,
  };
};

const getSelectableEdge = (edge: Edge): Edge => ({
  ...edge,
  focusable: true,
  interactionWidth: edge.interactionWidth ?? 28,
  type: "selectableSmoothstep",
  zIndex: edge.zIndex ?? 5,
});

const getDirectionalHandles = (
  edge: Edge,
  nodes: Node<InfraNodeData>[],
  sizeById: Map<string, { width: number; height: number }>,
) => {
  if (edge.sourceHandle && edge.targetHandle) return edge;

  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  if (!source || !target) return edge;

  const sourceSize = getNodeSize(source, sizeById);
  const targetSize = getNodeSize(target, sizeById);
  const sourceCenter = {
    x: source.position.x + sourceSize.width / 2,
    y: source.position.y + sourceSize.height / 2,
  };
  const targetCenter = {
    x: target.position.x + targetSize.width / 2,
    y: target.position.y + targetSize.height / 2,
  };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      ...edge,
      sourceHandle: edge.sourceHandle ?? (dx >= 0 ? "out-right" : "out-left"),
      targetHandle: edge.targetHandle ?? (dx >= 0 ? "out-left" : "out-right"),
    };
  }

  return {
    ...edge,
    sourceHandle: edge.sourceHandle ?? (dy >= 0 ? "out-bottom" : "out-top"),
    targetHandle: edge.targetHandle ?? (dy >= 0 ? "out-top" : "out-bottom"),
  };
};

export function InfraCanvas({ fitViewVersion, onNodeContextMenu, onNodeSelect }: InfraCanvasProps) {
  const {
    nodes,
    edges,
    selectedNodeIds,
    selectedZoneIds,
    onNodesChange,
    onEdgesChange,
    onConnect,
    reconnectEdge,
    setSelectedZone,
    toggleSelectedNode,
    toggleSelectedZone,
    updateNodeZoneByPosition,
    removeEdge,
  } = useInfraStore();
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<InfraNodeData> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const selectedEdgeIdRef = useRef<string | null>(null);
  const renderedEdges = useMemo(() => {
    const measuredNodes = reactFlow?.getNodes() ?? [];
    const sizeById = new Map(
      measuredNodes.map((node) => [node.id, { width: node.width ?? 220, height: node.height ?? 58 }]),
    );
    return edges.map((edge) => getSelectableEdge(getDirectionalHandles(edge, nodes, sizeById)));
  }, [edges, nodes, reactFlow]);
  const renderedNodes = useMemo(
    () => {
      const measuredNodes = reactFlow?.getNodes() ?? [];
      const sizeById = new Map(
        measuredNodes.map((node) => [node.id, { width: node.width ?? 220, height: node.height ?? 58 }]),
      );
      return nodes.map((node) => ({
        ...node,
        className:
          node.type === "infraNode" && hoveredNodeId === node.id
            ? `${node.className ?? ""} nodeHoverActive`.trim()
            : node.className,
        style:
          node.type === "zoneNode"
            ? getExpandedZoneStyle(node, nodes, sizeById)
            : node.style,
        selected: node.type === "zoneNode" ? selectedZoneIds.includes(node.id) : selectedNodeIds.includes(node.id),
      }));
    },
    [hoveredNodeId, nodes, reactFlow, selectedNodeIds, selectedZoneIds],
  );

  useEffect(() => {
    if (!reactFlow || nodes.length === 0) return;
    window.requestAnimationFrame(() => {
      const diagramNodes = reactFlow
        .getNodes()
        .filter((node) => node.type !== "zoneNode");

      const container = containerRef.current;
      if (!container || diagramNodes.length === 0) return;

      const bounds = diagramNodes.reduce(
        (current, node) => {
          const width = node.width ?? 220;
          const height = node.height ?? 58;
          return {
            minX: Math.min(current.minX, node.position.x),
            minY: Math.min(current.minY, node.position.y),
            maxX: Math.max(current.maxX, node.position.x + width),
            maxY: Math.max(current.maxY, node.position.y + height),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      const padding = 56;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const boundsWidth = bounds.maxX - bounds.minX;
      const boundsHeight = bounds.maxY - bounds.minY;
      const zoom = Math.max(
        0.35,
        Math.min(
          1.1,
          (width - padding * 2) / boundsWidth,
          (height - padding * 2) / boundsHeight,
        ),
      );
      const x = (width - boundsWidth * zoom) / 2 - bounds.minX * zoom;
      const y = (height - boundsHeight * zoom) / 2 - bounds.minY * zoom;

      reactFlow.setViewport({
        x,
        y,
        zoom,
      }, {
        duration: 450,
      });
    });
  }, [fitViewVersion, nodes.length, reactFlow]);

  const selectEdgeElement = (edgeId: string | null) => {
    selectedEdgeIdRef.current = edgeId;
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll(".edgeLabelButton.selected").forEach((element) => element.classList.remove("selected"));
    container.querySelectorAll(".react-flow__edge.edgeSelectedManaged").forEach((element) => {
      element.classList.remove("edgeSelectedManaged");
    });
    if (!edgeId) return;
    container
      .querySelector(`[data-testid="rf__edge-${CSS.escape(edgeId)}"]`)
      ?.classList.add("edgeSelectedManaged");
    container
      .querySelector(`.edgeLabelButton[data-edge-id="${CSS.escape(edgeId)}"]`)
      ?.classList.add("selected");
  };

  const handleReconnectEdge = (oldEdge: Edge, connection: Parameters<typeof reconnectEdge>[1]) => {
    reconnectEdge(oldEdge.id, connection);
    selectEdgeElement(oldEdge.id);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const selectedEdgeId = selectedEdgeIdRef.current;
      if (!selectedEdgeId) return;
      event.preventDefault();
      removeEdge(selectedEdgeId);
      selectEdgeElement(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [removeEdge]);

  useEffect(() => {
    const handleCustomEdgeSelect = (event: Event) => {
      const edgeId = (event as CustomEvent<{ edgeId?: string }>).detail?.edgeId;
      if (!edgeId) return;
      selectEdgeElement(edgeId);
    };

    window.addEventListener("infra-edge-select", handleCustomEdgeSelect);
    return () => window.removeEventListener("infra-edge-select", handleCustomEdgeSelect);
  }, []);

  return (
    <section
      className={`canvasShell ${isConnecting ? "isConnecting" : ""}`}
      ref={containerRef}
    >
      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={handleReconnectEdge}
        onEdgeUpdate={handleReconnectEdge}
        onConnectStart={() => setIsConnecting(true)}
        onConnectEnd={() => setIsConnecting(false)}
        onInit={setReactFlow}
        onNodeMouseEnter={(_, node) => {
          if (node.type === "infraNode") setHoveredNodeId(node.id);
        }}
        onNodeMouseLeave={(_, node) => {
          if (node.id === hoveredNodeId) setHoveredNodeId(null);
        }}
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          selectEdgeElement(edge.id);
        }}
        onNodeClick={(event, node) => {
          event.stopPropagation();
          selectEdgeElement(null);
          if (node.type === "zoneNode") {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              toggleSelectedZone(node.id);
              return;
            }
            setSelectedZone(node.id);
            return;
          }
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            toggleSelectedNode(node);
            return;
          }
          onNodeSelect(node);
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          onNodeContextMenu(node, { x: event.clientX, y: event.clientY });
        }}
        onNodeDragStop={(_, node) => {
          updateNodeZoneByPosition(node.id);
        }}
        onPaneClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(".react-flow__edge")) return;
          selectEdgeElement(null);
          setSelectedZone(null);
          onNodeSelect(null);
        }}
        elevateNodesOnSelect={false}
        deleteKeyCode={[]}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={42}
        reconnectRadius={18}
        edgesUpdatable
        connectOnClick={false}
        connectionLineStyle={{ stroke: "#2563eb", strokeWidth: 2 }}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.35}
        maxZoom={1.6}
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap pannable zoomable nodeStrokeWidth={3} />
      </ReactFlow>
    </section>
  );
}
