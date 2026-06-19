import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import type { InfraNodeData, ServerInventoryItem } from "../types/infra";

type InfraState = {
  nodes: Node<InfraNodeData>[];
  edges: Edge[];
  selectedNode: Node<InfraNodeData> | null;
  selectedNodeIds: string[];
  selectedZoneId: string | null;
  selectedZoneIds: string[];
  selectedEdgeIds: string[];
  setGraph: (nodes: Node<InfraNodeData>[], edges: Edge[]) => void;
  setSelectedNode: (node: Node<InfraNodeData> | null) => void;
  setSelectedZone: (zoneId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  setSelectedNodes: (nodes: Node<InfraNodeData>[]) => void;
  toggleSelectedNode: (node: Node<InfraNodeData>) => void;
  toggleSelectedZone: (zoneId: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addServerNode: (server: ServerInventoryItem) => void;
  attachServerToNode: (nodeId: string, server: ServerInventoryItem) => void;
  addServiceNode: (label: string, kind: InfraNodeData["kind"]) => void;
  addZone: () => void;
  updateNode: (nodeId: string, updates: Pick<InfraNodeData, "label" | "kind" | "logicalSubtitle" | "subtitle">) => void;
  alignSelectedNodes: (axis: "left" | "top") => void;
  distributeSelectedNodes: (axis: "horizontal" | "vertical") => void;
  resizeSelectedNodes: (mode: "width" | "height" | "both") => void;
  optimizeSelectedZones: () => void;
  updateNodeZoneByPosition: (nodeId: string) => void;
  updateEdge: (
    edgeId: string,
    updates: { label: string; connectionType: string; color: string; animated: boolean },
  ) => void;
  removeEdge: (edgeId: string) => void;
  removeSelectedEdges: () => void;
  removeNode: (nodeId: string) => void;
  removeServer: (serverId: string) => void;
};

const roleToKind = (role: string): InfraNodeData["kind"] => {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole.includes("DB")) return "db";
  if (normalizedRole.includes("ETL") || normalizedRole.includes("SCHEDULER")) return "batch";
  return "server";
};

const hasServerRisk = (server: ServerInventoryItem) => server.deletePlanned || server.hasPublicIp;

const getNodeWidth = (node: Node<InfraNodeData>) => {
  const width = Number((node.style as { width?: number } | undefined)?.width);
  return Number.isFinite(width) && width > 0 ? width : 220;
};

const getNodeHeight = (node: Node<InfraNodeData>) => {
  const height = Number((node.style as { height?: number } | undefined)?.height);
  return Number.isFinite(height) && height > 0 ? height : 58;
};

const getEditableSelectedNodes = (nodes: Node<InfraNodeData>[], selectedNodeIds: string[]) => {
  const selectedIds = new Set(selectedNodeIds);
  return nodes.filter((node) => node.type !== "zoneNode" && selectedIds.has(node.id));
};

const getDefaultZoneId = (node: Node<InfraNodeData>) => {
  if (node.type === "zoneNode") return undefined;
  if (node.data.zoneId) return node.data.zoneId;
  if (node.id.startsWith("client-")) return "zone-dmz";
  if (node.id.startsWith("db-")) return "zone-db";
  if (node.id.startsWith("mgmt-")) return "zone-mgmt";
  if (
    node.id.startsWith("gateway-") ||
    node.id.startsWith("api-") ||
    node.id === "kafka" ||
    node.id === "vault" ||
    node.id === "jenkins" ||
    node.id.includes("airflow")
  ) {
    return "zone-private";
  }
  return undefined;
};

const getZoneIdByServer = (server: ServerInventoryItem) => {
  if (server.networkZone === "dmz") return "zone-dmz";
  if (server.role.toUpperCase().includes("DB")) return "zone-db";
  return "zone-private";
};

const getContainingZoneId = (node: Node<InfraNodeData>, nodes: Node<InfraNodeData>[]) => {
  if (node.type === "zoneNode") return undefined;
  const center = {
    x: node.position.x + getNodeWidth(node) / 2,
    y: node.position.y + getNodeHeight(node) / 2,
  };
  const containingZones = nodes
    .filter((item) => item.type === "zoneNode")
    .filter((zone) => {
      const zoneWidth = getNodeWidth(zone);
      const zoneHeight = getNodeHeight(zone);
      return (
        center.x >= zone.position.x &&
        center.y >= zone.position.y &&
        center.x <= zone.position.x + zoneWidth &&
        center.y <= zone.position.y + zoneHeight
      );
    })
    .sort((a, b) => getNodeWidth(a) * getNodeHeight(a) - getNodeWidth(b) * getNodeHeight(b));

  return containingZones[0]?.id;
};

const normalizeNodeZones = (nodes: Node<InfraNodeData>[], mode: "missing" | "position" = "missing") =>
  nodes.map((node) => {
    if (node.type === "zoneNode") return node;
    const zoneId = mode === "position" ? getContainingZoneId(node, nodes) : node.data.zoneId ?? getContainingZoneId(node, nodes) ?? getDefaultZoneId(node);
    const kind =
      node.data.kind === "airflow"
        ? "batch"
        : node.id === "vault" && node.data.kind === "infra"
          ? "secrets"
          : node.data.kind;
    if (zoneId === node.data.zoneId && kind === node.data.kind) return node;
    return {
      ...node,
      data: {
        ...node.data,
        kind,
        zoneId,
      },
    };
  });

const getZoneChildren = (zoneId: string, nodes: Node<InfraNodeData>[]) => {
  const zone = nodes.find((node) => node.id === zoneId && node.type === "zoneNode");
  if (!zone) return [];

  const assignedChildren = nodes.filter((node) => node.type !== "zoneNode" && node.data.zoneId === zoneId);
  if (assignedChildren.length > 0) return assignedChildren;

  const knownZoneMatchers: Record<string, (node: Node<InfraNodeData>) => boolean> = {
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

  const matcher = knownZoneMatchers[zoneId];
  if (matcher) {
    return nodes.filter((node) => node.type !== "zoneNode" && matcher(node));
  }

  const zoneWidth = getNodeWidth(zone);
  const zoneHeight = getNodeHeight(zone);
  return nodes.filter((node) => {
    if (node.type === "zoneNode") return false;
    return (
      node.position.x >= zone.position.x &&
      node.position.y >= zone.position.y &&
      node.position.x <= zone.position.x + zoneWidth &&
      node.position.y <= zone.position.y + zoneHeight
    );
  });
};

const roundUpToGrid = (value: number, grid = 20) => Math.ceil(value / grid) * grid;

const getZoneContentSize = (
  zoneId: string,
  nodes: Node<InfraNodeData>[],
  position: { x: number; y: number },
  minSize: { width: number; height: number },
) => {
  const children = getZoneChildren(zoneId, nodes);
  if (children.length === 0) return minSize;

  const bounds = children.reduce(
    (current, child) => ({
      maxX: Math.max(current.maxX, child.position.x + getNodeWidth(child)),
      maxY: Math.max(current.maxY, child.position.y + getNodeHeight(child)),
    }),
    { maxX: position.x, maxY: position.y },
  );
  const paddingRight = 34;
  const paddingBottom = 34;

  return {
    width: roundUpToGrid(Math.max(minSize.width, bounds.maxX - position.x + paddingRight)),
    height: roundUpToGrid(Math.max(minSize.height, bounds.maxY - position.y + paddingBottom)),
  };
};

const getAssignedServers = (data: InfraNodeData): ServerInventoryItem[] => {
  const servers = data.servers ?? [];
  if (data.server && !servers.some((server) => server.id === data.server?.id)) {
    return [...servers, data.server];
  }
  return servers;
};

const detachServer = (node: Node<InfraNodeData>, serverId: string): Node<InfraNodeData> => {
  const currentServers = getAssignedServers(node.data).filter((server) => server.id !== serverId);
  const { server: _server, servers: _servers, ...data } = node.data;
  const logicalSubtitle = data.logicalSubtitle ?? data.subtitle ?? data.kind.toUpperCase();
  return {
    ...node,
    data: {
      ...data,
      logicalSubtitle,
      servers: currentServers.length > 0 ? currentServers : undefined,
      subtitle: logicalSubtitle,
      risk: currentServers.some(hasServerRisk) ? "warning" : data.risk === "warning" ? "normal" : data.risk,
    },
  };
};

export const useInfraStore = create<InfraState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedNodeIds: [],
  selectedZoneId: null,
  selectedZoneIds: [],
  selectedEdgeIds: [],
  setGraph: (nodes, edges) =>
    set({
      nodes: normalizeNodeZones(nodes),
      edges,
      selectedNode: null,
      selectedNodeIds: [],
      selectedZoneId: null,
      selectedZoneIds: [],
      selectedEdgeIds: [],
    }),
  setSelectedNode: (node) =>
    set({
      selectedNode: node,
      selectedNodeIds: node && node.type !== "zoneNode" ? [node.id] : [],
      selectedZoneId: node?.type === "zoneNode" ? node.id : null,
      selectedZoneIds: node?.type === "zoneNode" ? [node.id] : [],
      selectedEdgeIds: [],
    }),
  setSelectedZone: (zoneId) =>
    set({
      selectedNode: zoneId ? get().nodes.find((node) => node.id === zoneId) ?? null : null,
      selectedNodeIds: [],
      selectedZoneId: zoneId,
      selectedZoneIds: zoneId ? [zoneId] : [],
      selectedEdgeIds: [],
    }),
  setSelectedEdge: (edgeId) =>
    set({
      selectedNode: null,
      selectedNodeIds: [],
      selectedZoneId: null,
      selectedZoneIds: [],
      selectedEdgeIds: edgeId ? [edgeId] : [],
    }),
  setSelectedNodes: (selectedNodes) => {
    const nextIds = selectedNodes.filter((node) => node.type !== "zoneNode").map((node) => node.id);
    const currentIds = get().selectedNodeIds;
    if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) {
      return;
    }
    set({
      selectedNode: selectedNodes[selectedNodes.length - 1] ?? null,
      selectedNodeIds: nextIds,
      selectedZoneId: null,
      selectedZoneIds: [],
      selectedEdgeIds: [],
    });
  },
  toggleSelectedNode: (node) => {
    if (node.type === "zoneNode") return;
    const currentIds = get().selectedNodeIds;
    const isSelected = currentIds.includes(node.id);
    const nextIds = isSelected ? currentIds.filter((id) => id !== node.id) : [...currentIds, node.id];
    set({
      selectedNode: isSelected ? get().nodes.find((item) => item.id === nextIds[nextIds.length - 1]) ?? null : node,
      selectedNodeIds: nextIds,
      selectedZoneId: null,
      selectedZoneIds: [],
      selectedEdgeIds: [],
    });
  },
  toggleSelectedZone: (zoneId) => {
    const currentIds = get().selectedZoneIds;
    const isSelected = currentIds.includes(zoneId);
    const nextIds = isSelected ? currentIds.filter((id) => id !== zoneId) : [...currentIds, zoneId];
    set({
      selectedNode: get().nodes.find((node) => node.id === nextIds[nextIds.length - 1]) ?? null,
      selectedNodeIds: [],
      selectedZoneId: nextIds[nextIds.length - 1] ?? null,
      selectedZoneIds: nextIds,
      selectedEdgeIds: [],
    });
  },
  onNodesChange: (changes) => {
    const actionableChanges = changes.filter((change) => change.type !== "dimensions" && change.type !== "select");
    if (actionableChanges.length === 0) return;
    const changedNodes = applyNodeChanges(actionableChanges, get().nodes);
    set({
      nodes: normalizeNodeZones(changedNodes, "position"),
    });
  },
  onEdgesChange: (changes) => {
    const actionableChanges = changes.filter((change) => change.type !== "select" && change.type !== "remove");
    if (actionableChanges.length === 0) return;
    set({
      edges: applyEdgeChanges(actionableChanges, get().edges),
    });
  },
  onConnect: (connection) =>
    set({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
          animated: true,
          interactionWidth: 28,
          label: "REST",
          zIndex: 5,
          data: { connectionType: "rest" },
        },
        get().edges,
      ),
    }),
  addServerNode: (server) => {
    const exists = get().nodes.some((node) =>
      getAssignedServers(node.data).some((assignedServer) => assignedServer.id === server.id),
    );
    if (exists) return;
    const offset = get().nodes.length * 20;
    const x = server.networkZone === "dmz" ? 130 : 500;
    const y = server.role.toUpperCase().includes("DB") ? 540 : 190 + offset;
    const logicalSubtitle = `${server.systemName} 쨌 ${server.role}`;
    set({
      nodes: [
        ...get().nodes,
        {
          id: server.id,
          type: "infraNode",
          position: { x, y },
          data: {
            label: server.serverName,
            subtitle: logicalSubtitle,
            logicalSubtitle,
            kind: roleToKind(server.role),
            server,
            servers: [server],
            zoneId: getZoneIdByServer(server),
            risk: hasServerRisk(server) ? "warning" : "normal",
          },
        },
      ],
    });
  },
  attachServerToNode: (nodeId, server) => {
    const nodesWithoutServer = get().nodes
      .filter((node) => node.id !== server.id)
      .map((node) =>
        getAssignedServers(node.data).some((assignedServer) => assignedServer.id === server.id)
          ? detachServer(node, server.id)
          : node,
      );
    let selectedNode = get().selectedNode;
    const nodes = nodesWithoutServer.map((node) => {
      if (node.id !== nodeId) return node;
      const logicalSubtitle = node.data.logicalSubtitle ?? node.data.subtitle ?? node.data.kind.toUpperCase();
      const currentServers = getAssignedServers(node.data);
      const nextServers = currentServers.some((assignedServer) => assignedServer.id === server.id)
        ? currentServers
        : [...currentServers, server];
      const updatedNode: Node<InfraNodeData> = {
        ...node,
        data: {
          ...node.data,
          server: undefined,
          logicalSubtitle,
          servers: nextServers,
          zoneId: node.data.zoneId ?? getZoneIdByServer(server),
          subtitle: logicalSubtitle,
          risk: nextServers.some(hasServerRisk) ? "warning" : node.data.risk ?? "normal",
        },
      };
      selectedNode = updatedNode;
      return updatedNode;
    });

    set({
      nodes,
      edges: get().edges.filter((edge) => edge.source !== server.id && edge.target !== server.id),
      selectedNode,
    });
  },
  addServiceNode: (label, kind) => {
    const id = `${kind}-node-${Date.now()}`;
    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: "infraNode",
          position: { x: 340, y: 120 + get().nodes.length * 16 },
          data: { label, kind, subtitle: kind.toUpperCase(), logicalSubtitle: kind.toUpperCase(), zoneId: "zone-private", risk: "normal" },
        },
      ],
    });
  },
  addZone: () => {
    const zones = get().nodes.filter((node) => node.type === "zoneNode");
    const id = `zone-custom-${Date.now()}`;
    const maxRight = get().nodes.reduce((right, node) => Math.max(right, node.position.x + getNodeWidth(node)), 0);
    const customZoneCount = zones.filter((zone) => zone.id.startsWith("zone-custom-")).length;
    const offset = customZoneCount * 20;
    const zoneNode: Node<InfraNodeData> = {
      id,
      type: "zoneNode",
      position: { x: roundUpToGrid(maxRight + 80 + offset), y: 40 + offset },
      selectable: false,
      draggable: true,
      zIndex: 0,
      data: {
        label: `Custom Zone ${customZoneCount + 1}`,
        subtitle: "Custom network zone",
        kind: "zone",
      },
      style: { width: 360, height: 260 },
    };

    set({
      nodes: [...get().nodes, zoneNode],
      selectedNode: zoneNode,
      selectedNodeIds: [],
      selectedZoneId: id,
      selectedZoneIds: [id],
    });
  },
  updateNode: (nodeId, updates) => {
    let updatedSelectedNode = get().selectedNode;
    const nodes = get().nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const updatedNode = {
        ...node,
        data: {
          ...node.data,
          ...updates,
        },
      };
      updatedSelectedNode = updatedNode;
      return updatedNode;
    });
    set({
      nodes,
      selectedNode: get().selectedNode?.id === nodeId ? updatedSelectedNode : get().selectedNode,
    });
  },
  alignSelectedNodes: (axis) => {
    const selectedNodes = getEditableSelectedNodes(get().nodes, get().selectedNodeIds);
    if (selectedNodes.length < 2) return;
    const targetPosition =
      axis === "left"
        ? Math.min(...selectedNodes.map((node) => node.position.x))
        : Math.min(...selectedNodes.map((node) => node.position.y));
    set({
      nodes: get().nodes.map((node) => {
        if (!selectedNodes.some((selectedNode) => selectedNode.id === node.id)) return node;
        return {
          ...node,
          position:
            axis === "left"
              ? { ...node.position, x: targetPosition }
              : { ...node.position, y: targetPosition },
        };
      }),
    });
  },
  distributeSelectedNodes: (axis) => {
    const selectedNodes = getEditableSelectedNodes(get().nodes, get().selectedNodeIds);
    if (selectedNodes.length < 3) return;
    const sortedNodes = [...selectedNodes].sort((a, b) =>
      axis === "horizontal" ? a.position.x - b.position.x : a.position.y - b.position.y,
    );
    const first = sortedNodes[0];
    const last = sortedNodes[sortedNodes.length - 1];
    const firstStart = axis === "horizontal" ? first.position.x : first.position.y;
    const lastStart = axis === "horizontal" ? last.position.x : last.position.y;
    const firstSize = axis === "horizontal" ? getNodeWidth(first) : getNodeHeight(first);
    const lastSize = axis === "horizontal" ? getNodeWidth(last) : getNodeHeight(last);
    const totalSize = sortedNodes.reduce(
      (sum, node) => sum + (axis === "horizontal" ? getNodeWidth(node) : getNodeHeight(node)),
      0,
    );
    const availableSpace = lastStart + lastSize - firstStart - totalSize;
    const gap = Math.max(24, availableSpace / (sortedNodes.length - 1));
    let cursor = firstStart;
    const positionById = new Map<string, number>();
    sortedNodes.forEach((node) => {
      positionById.set(node.id, cursor);
      cursor += (axis === "horizontal" ? getNodeWidth(node) : getNodeHeight(node)) + gap;
    });
    set({
      nodes: get().nodes.map((node) => {
        const position = positionById.get(node.id);
        if (position === undefined) return node;
        return {
          ...node,
          position:
            axis === "horizontal"
              ? { ...node.position, x: position }
              : { ...node.position, y: position },
        };
      }),
    });
  },
  resizeSelectedNodes: (mode) => {
    const selectedNodes = getEditableSelectedNodes(get().nodes, get().selectedNodeIds);
    if (selectedNodes.length < 2) return;
    const targetWidth = Math.max(...selectedNodes.map(getNodeWidth));
    const targetHeight = Math.max(...selectedNodes.map(getNodeHeight));
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    set({
      nodes: get().nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;
        return {
          ...node,
          style: {
            ...node.style,
            width: mode === "width" || mode === "both" ? targetWidth : (node.style as { width?: number })?.width,
            height:
              mode === "height" || mode === "both" ? targetHeight : (node.style as { height?: number })?.height,
          },
        };
      }),
    });
  },
  optimizeSelectedZones: () => {
    const currentNodes = get().nodes;
    const zoneIds = currentNodes.filter((node) => node.type === "zoneNode").map((node) => node.id);
    if (zoneIds.length === 0) return;

    const leftX = 20;
    const topY = 40;
    const columnGap = 40;
    const rowGap = 40;
    const leftWidth = 390;
    const privateWidth = 540;
    const dbWidth = 560;
    const privateX = leftX + leftWidth + columnGap;
    const dbX = privateX + privateWidth + 45;
    const dbY = topY;
    const dmzSize = getZoneContentSize("zone-dmz", currentNodes, { x: leftX, y: topY }, { width: leftWidth, height: 620 });
    const dmzHeight = dmzSize.height;
    const mgmtY = topY + dmzHeight + rowGap;
    const mgmtSize = getZoneContentSize("zone-mgmt", currentNodes, { x: leftX, y: mgmtY }, { width: leftWidth, height: 310 });
    const privateSize = getZoneContentSize("zone-private", currentNodes, { x: privateX, y: topY }, { width: privateWidth, height: 620 });
    const dbSize = getZoneContentSize("zone-db", currentNodes, { x: dbX, y: dbY }, { width: dbWidth, height: 420 });
    const alignedBottomY = roundUpToGrid(
      Math.max(mgmtY + mgmtSize.height, topY + privateSize.height, dbY + dbSize.height),
    );
    const mgmtHeight = alignedBottomY - mgmtY;
    const privateHeight = alignedBottomY - topY;
    const dbHeight = privateHeight;
    const optimizedZones: Record<string, { x: number; y: number; width: number; height: number }> = {
      "zone-dmz": { x: leftX, y: topY, width: leftWidth, height: dmzHeight },
      "zone-mgmt": { x: leftX, y: mgmtY, width: leftWidth, height: mgmtHeight },
      "zone-private": { x: privateX, y: topY, width: privateWidth, height: privateHeight },
      "zone-db": { x: dbX, y: dbY, width: dbWidth, height: dbHeight },
    };
    const optimizedZoneIds = new Set(Object.keys(optimizedZones));

    set({
      nodes: currentNodes.map((node) => {
        if (node.type !== "zoneNode") return node;
        const optimizedZone = optimizedZones[node.id];
        if (optimizedZone) {
          return {
            ...node,
            position: { x: optimizedZone.x, y: optimizedZone.y },
            style: {
              ...node.style,
              width: optimizedZone.width,
              height: optimizedZone.height,
            },
          };
        }
        if (optimizedZoneIds.has(node.id)) return node;
        const fallbackSize = getZoneContentSize(node.id, currentNodes, node.position, {
          width: getNodeWidth(node),
          height: getNodeHeight(node),
        });
        return {
          ...node,
          style: {
            ...node.style,
            width: fallbackSize.width,
            height: fallbackSize.height,
          },
        };
      }),
    });
  },
  updateNodeZoneByPosition: (nodeId) => {
    const currentNodes = get().nodes;
    const node = currentNodes.find((item) => item.id === nodeId);
    if (!node || node.type === "zoneNode") return;
    const zoneId = getContainingZoneId(node, currentNodes);
    if (zoneId === node.data.zoneId) return;
    const nodes = currentNodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            data: {
              ...item.data,
              zoneId,
            },
          }
        : item,
    );
    set({
      nodes,
      selectedNode: get().selectedNode?.id === nodeId ? nodes.find((item) => item.id === nodeId) ?? null : get().selectedNode,
    });
  },
  removeSelectedEdges: () => {
    const selectedEdgeIds = get().selectedEdgeIds;
    if (selectedEdgeIds.length === 0) return;
    const selectedEdgeIdSet = new Set(selectedEdgeIds);
    set({
      edges: get().edges.filter((edge) => !selectedEdgeIdSet.has(edge.id)),
      selectedEdgeIds: [],
    });
  },
  updateEdge: (edgeId, updates) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        return {
          ...edge,
          animated: updates.animated,
          label: updates.label,
          data: {
            ...edge.data,
            connectionType: updates.connectionType,
          },
          style: {
            ...edge.style,
            stroke: updates.color,
          },
          labelStyle: {
            ...edge.labelStyle,
            fill: updates.color,
          },
        };
      }),
    });
  },
  removeEdge: (edgeId) => {
    set({
      edges: get().edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeIds: get().selectedEdgeIds.filter((id) => id !== edgeId),
    });
  },
  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNode: get().selectedNode?.id === nodeId ? null : get().selectedNode,
      selectedNodeIds: get().selectedNodeIds.filter((id) => id !== nodeId),
      selectedZoneId: get().selectedZoneId === nodeId ? null : get().selectedZoneId,
      selectedZoneIds: get().selectedZoneIds.filter((id) => id !== nodeId),
      selectedEdgeIds: get()
        .selectedEdgeIds.filter((id) => get().edges.some((edge) => edge.id === id && edge.source !== nodeId && edge.target !== nodeId)),
    });
  },
  removeServer: (serverId) => {
    const nodes = get().nodes
      .filter((node) => node.id !== serverId)
      .map((node) =>
        getAssignedServers(node.data).some((assignedServer) => assignedServer.id === serverId)
          ? detachServer(node, serverId)
          : node,
      );
    const selectedNode = get().selectedNode;
    const updatedSelected =
      selectedNode?.id === serverId
        ? null
        : selectedNode && getAssignedServers(selectedNode.data).some((server) => server.id === serverId)
          ? detachServer(selectedNode, serverId)
          : selectedNode;

    set({
      nodes,
      edges: get().edges.filter((edge) => edge.source !== serverId && edge.target !== serverId),
      selectedNode: updatedSelected,
    });
  },
}));

