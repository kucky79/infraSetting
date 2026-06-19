import type { Edge, Node } from "reactflow";
import type { InfraNodeData } from "../types/infra";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 58;
const ZONE_WIDTH = 360;
const ZONE_HEIGHT = 260;
const PADDING = 60;

const getNodeWidth = (node: Node<InfraNodeData>) => {
  const width = Number((node.style as { width?: number } | undefined)?.width);
  return Number.isFinite(width) && width > 0 ? width : node.type === "zoneNode" ? ZONE_WIDTH : NODE_WIDTH;
};

const getNodeHeight = (node: Node<InfraNodeData>) => {
  const height = Number((node.style as { height?: number } | undefined)?.height);
  return Number.isFinite(height) && height > 0 ? height : node.type === "zoneNode" ? ZONE_HEIGHT : NODE_HEIGHT;
};

const getBounds = (nodes: Node<InfraNodeData>[]): Bounds => {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.position.x),
      minY: Math.min(bounds.minY, node.position.y),
      maxX: Math.max(bounds.maxX, node.position.x + getNodeWidth(node)),
      maxY: Math.max(bounds.maxY, node.position.y + getNodeHeight(node)),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const escapeMermaid = (value: unknown) =>
  String(value ?? "")
    .replace(/"/g, "'")
    .replace(/\|/g, "/")
    .replace(/\r?\n/g, " ");

const mermaidId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

export const exportDiagramMermaid = (nodes: Node<InfraNodeData>[], edges: Edge[]) => {
  const zones = nodes.filter((node) => node.type === "zoneNode");
  const graphNodes = nodes.filter((node) => node.type !== "zoneNode");
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const lines = ["flowchart LR"];
  const written = new Set<string>();

  zones.forEach((zone) => {
    lines.push(`  subgraph ${mermaidId(zone.id)}["${escapeMermaid(zone.data.label)}"]`);
    graphNodes
      .filter((node) => node.data.zoneId === zone.id)
      .forEach((node) => {
        written.add(node.id);
        const subtitle = node.data.logicalSubtitle ?? node.data.subtitle;
        const label = subtitle ? `${node.data.label}<br/>${subtitle}` : node.data.label;
        lines.push(`    ${mermaidId(node.id)}["${escapeMermaid(label)}"]`);
      });
    lines.push("  end");
  });

  graphNodes
    .filter((node) => !written.has(node.id) || !zoneById.has(node.data.zoneId ?? ""))
    .forEach((node) => {
      const subtitle = node.data.logicalSubtitle ?? node.data.subtitle;
      const label = subtitle ? `${node.data.label}<br/>${subtitle}` : node.data.label;
      lines.push(`  ${mermaidId(node.id)}["${escapeMermaid(label)}"]`);
    });

  edges.forEach((edge) => {
    const label = edge.label ? `|"${escapeMermaid(edge.label)}"|` : "";
    lines.push(`  ${mermaidId(edge.source)} -->${label} ${mermaidId(edge.target)}`);
  });

  downloadBlob(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }), "infra-diagram.mmd");
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const drawText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 16,
) => {
  const words = text.split(" ");
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y);
      y += lineHeight;
      line = word;
      return;
    }
    line = next;
  });
  if (line) context.fillText(line, x, y);
};

const createDiagramCanvas = (nodes: Node<InfraNodeData>[], edges: Edge[], scale = 2) => {
  const bounds = getBounds(nodes);
  const width = Math.ceil(bounds.maxX - bounds.minX + PADDING * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + PADDING * 2);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is not available.");
  context.scale(scale, scale);
  context.translate(PADDING - bounds.minX, PADDING - bounds.minY);

  context.fillStyle = "#e8edf3";
  context.fillRect(bounds.minX - PADDING, bounds.minY - PADDING, width, height);
  context.fillStyle = "#c9d4df";
  for (let x = bounds.minX - PADDING; x < bounds.maxX + PADDING; x += 20) {
    for (let y = bounds.minY - PADDING; y < bounds.maxY + PADDING; y += 20) {
      context.fillRect(x, y, 1, 1);
    }
  }

  nodes
    .filter((node) => node.type === "zoneNode")
    .forEach((node) => {
      const width = getNodeWidth(node);
      const height = getNodeHeight(node);
      drawRoundedRect(context, node.position.x, node.position.y, width, height, 8);
      context.fillStyle = "rgba(255,255,255,0.62)";
      context.fill();
      context.strokeStyle = "#9ba9b7";
      context.setLineDash([4, 3]);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#253244";
      context.font = "700 15px Segoe UI, sans-serif";
      context.fillText(node.data.label, node.position.x + 14, node.position.y + 24);
      context.fillStyle = "#617080";
      context.font = "12px Segoe UI, sans-serif";
      if (node.data.subtitle) context.fillText(node.data.subtitle, node.position.x + 14, node.position.y + 44);
    });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  edges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;
    const sx = source.position.x + getNodeWidth(source);
    const sy = source.position.y + getNodeHeight(source) / 2;
    const tx = target.position.x;
    const ty = target.position.y + getNodeHeight(target) / 2;
    const midX = sx + (tx - sx) / 2;
    context.strokeStyle = String((edge.style as { stroke?: string } | undefined)?.stroke ?? "#64748b");
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(sx, sy);
    context.lineTo(midX, sy);
    context.lineTo(midX, ty);
    context.lineTo(tx, ty);
    context.stroke();
    if (edge.label) {
      context.fillStyle = "rgba(248,250,252,0.94)";
      const label = String(edge.label);
      const labelWidth = Math.min(120, context.measureText(label).width + 12);
      context.fillRect(midX - labelWidth / 2, (sy + ty) / 2 - 11, labelWidth, 22);
      context.fillStyle = context.strokeStyle;
      context.font = "700 11px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText(label, midX, (sy + ty) / 2 + 4);
      context.textAlign = "left";
    }
  });

  nodes
    .filter((node) => node.type !== "zoneNode")
    .forEach((node) => {
      const width = getNodeWidth(node);
      const height = getNodeHeight(node);
      const borderColor =
        node.data.kind === "db"
          ? "#8f5c2c"
          : node.data.kind === "gateway"
            ? "#2f6f55"
            : node.data.kind === "secrets"
              ? "#7c3aed"
              : node.data.kind === "batch"
                ? "#64748b"
                : "#2563eb";
      drawRoundedRect(context, node.position.x, node.position.y, width, height, 8);
      context.fillStyle = "#ffffff";
      context.fill();
      context.strokeStyle = borderColor;
      context.stroke();
      context.fillStyle = "#edf2f7";
      drawRoundedRect(context, node.position.x + 12, node.position.y + 12, 28, 28, 6);
      context.fill();
      context.fillStyle = "#17202a";
      context.font = "700 13px Segoe UI, sans-serif";
      drawText(context, node.data.label, node.position.x + 52, node.position.y + 23, width - 64, 16);
      const subtitle = node.data.logicalSubtitle ?? node.data.subtitle;
      if (subtitle) {
        context.fillStyle = "#617080";
        context.font = "11px Segoe UI, sans-serif";
        drawText(context, subtitle, node.position.x + 52, node.position.y + 42, width - 64, 14);
      }
    });

  return canvas;
};

export const exportDiagramImage = (nodes: Node<InfraNodeData>[], edges: Edge[]) => {
  const canvas = createDiagramCanvas(nodes, edges, 2);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, "infra-diagram.png");
  }, "image/png");
};

const dataUrlToBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const asciiBytes = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0));

const concatBytes = (chunks: Uint8Array[]) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });
  return bytes;
};

export const exportDiagramPdf = (nodes: Node<InfraNodeData>[], edges: Edge[]) => {
  const canvas = createDiagramCanvas(nodes, edges, 2);
  const imageBytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92));
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
  const drawWidth = canvas.width * ratio;
  const drawHeight = canvas.height * ratio;
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    `<< /Length ${asciiBytes(content).length} >>\nstream\n${content}endstream`,
  ];
  const chunks: Uint8Array[] = [asciiBytes("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    let chunk: Uint8Array;
    if (index === 3) {
      chunk = concatBytes([asciiBytes(`4 0 obj\n${object}`), imageBytes, asciiBytes("\nendstream\nendobj\n")]);
    } else {
      chunk = asciiBytes(`${index + 1} 0 obj\n${object}\nendobj\n`);
    }
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = [
    "xref",
    "0 6",
    "0000000000 65535 f ",
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n `),
    "trailer",
    "<< /Size 6 /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");
  chunks.push(asciiBytes(xref));
  downloadBlob(new Blob([concatBytes(chunks)], { type: "application/pdf" }), "infra-diagram.pdf");
};
