#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerArtistTools } from "./tools/artists.js";
import { registerArtworkTools } from "./tools/artworks.js";
import { registerRecordTools } from "./tools/records.js";

const VERSION = "0.1.0";

function createServer(): McpServer {
  const server = new McpServer({
    name: "whitney-mcp-server",
    version: VERSION,
  });

  registerArtworkTools(server);
  registerArtistTools(server);
  registerRecordTools(server);

  return server;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(
      [
        `whitney-mcp-server ${VERSION}`,
        "",
        "An MCP server over the Whitney Museum of American Art public API.",
        "Speaks stdio; run it from an MCP client rather than directly.",
        "",
        "Data is public and unauthenticated. Whitney's terms permit noncommercial",
        "educational and personal use with attribution retained.",
        "",
      ].join("\n"),
    );
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdout carries the protocol; diagnostics must go to stderr.
  process.stderr.write(`whitney-mcp-server ${VERSION} running on stdio\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
