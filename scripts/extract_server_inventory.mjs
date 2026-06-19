import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs
  .readdirSync(root)
  .find((file) => file.endsWith(".xlsx") && file.includes("서버자원"));

if (!source) {
  throw new Error("서버자원_팀별분류.xlsx 파일을 찾을 수 없습니다.");
}

const sourcePath = path.join(root, source);
const outputPath = path.join(root, "public", "data", "servers.json");

const workbook = xlsx.readFile(sourcePath);
const worksheet = workbook.Sheets["서버목록"];
if (!worksheet) {
  throw new Error("서버목록 시트를 찾을 수 없습니다.");
}

const rows = xlsx.utils.sheet_to_json(worksheet, {
  defval: "",
  raw: false,
});

const splitIps = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const inferNetworkZone = (ips) => {
  if (ips.some((ip) => ip.startsWith("192.168."))) return "dmz";
  if (ips.some((ip) => ip.startsWith("172.16.") || ip.startsWith("172.20.") || ip.startsWith("10."))) return "private";
  return "unknown";
};

const hasPublicIp = (ips) =>
  ips.some((ip) => {
    const privateIp =
      ip.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip.startsWith("192.168.");
    return !privateIp;
  });

const serverId = (name, no) => {
  const slug = String(name || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  return `server-${slug || no}`;
};

const servers = rows
  .filter((row) => row["서버명"])
  .map((row, index) => {
    const no = Number(row["No"] || index + 1);
    const serverName = String(row["서버명"]);
    const ips = splitIps(row["IP"]);
    const note = String(row["비고"] || "");
    const deletePlanned = note.includes("삭제예정") || Boolean(row["삭제예정"]);

    return {
      id: serverId(serverName, no),
      no,
      serverName,
      systemName: String(row["시스템명"] || ""),
      role: String(row["역할/구분"] || ""),
      os: String(row["OS"] || ""),
      ips,
      spec: String(row["스펙"] || ""),
      availabilityZone: String(row["가용존"] || ""),
      team: String(row["분류"] || ""),
      note,
      deletePlanned,
      networkZone: inferNetworkZone(ips),
      hasPublicIp: hasPublicIp(ips),
    };
  });

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      source,
      version: "1.0",
      count: servers.length,
      servers,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(`wrote ${outputPath} (${servers.length} servers)`);
