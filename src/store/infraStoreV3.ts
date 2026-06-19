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
  setGraph: (nodes: Node<InfraNodeData>[], edges: Edge[]) => void;
  setSelectedNode: (node: Node<InfraNodeData> | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addServerNode: (server: ServerInventoryItem) => void;
  attachServerToNode: (nodeId: string, server: ServerInventoryItem) => void;
  addServiceNode: (label: string, kind: InfraNodeData["kind"]) => void;
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

const summarizeServers = (logicalSubtitle: string, servers: ServerInventoryItem[]) => {
  if (servers.length === 0) return logicalSubtitle;
  if (servers.length <= 2) {
    return `${logicalSubtitle} · ${servers.map((server) => server.serverName).join(", ")}`;
  }
  return `${logicalSubtitle} · ${servers[0].serverName} 외 ${servers.length - 1}대`;
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
      subtitle: summarizeServers(logicalSubtitle, currentServers),
      risk: currentServers.some(hasServerRisk) ? "warning" : data.risk === "warning" ? "normal" : data.risk,
    },
  };
};

export const useInfraStore = create<InfraState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  setGraph: (nodes, edges) => set({ nodes, edges }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  onNodesChange: (changes) =>
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    }),
  onEdgesChange: (changes) =>
    set({
      edges: applyEdgeChanges(changes, get().edges),
    }),
  onConnect: (connection) =>
    set({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
          animated: true,
          label: "REST",
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
    set({
      nodes: [
        ...get().nodes,
        {
          id: server.id,
          type: "infraNode",
          position: { x, y },
          data: {
            label: server.serverName,
            subtitle: `${server.systemName} · ${server.role}`,
            logicalSubtitle: `${server.systemName} · ${server.role}`,
            kind: roleToKind(server.role),
            server,
            servers: [server],
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
          subtitle: summarizeServers(logicalSubtitle, nextServers),
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
    const slug = label.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-|-$/g, "");
    const id = `${kind}-${slug || "node"}-${Date.now()}`;
    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: "infraNode",
          position: { x: 340, y: 120 + get().nodes.length * 16 },
          data: { label, kind, subtitle: kind.toUpperCase(), logicalSubtitle: kind.toUpperCase(), risk: "normal" },
        },
      ],
    });
  },
  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNode: get().selectedNode?.id === nodeId ? null : get().selectedNode,
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
