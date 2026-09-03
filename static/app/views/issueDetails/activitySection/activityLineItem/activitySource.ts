const MCP_SOURCE_NAMES: Record<string, string> = {
  mcp: 'MCP',
  'mcp:claude-code': 'Claude Code',
  'mcp:claude-desktop': 'Claude Desktop',
  'mcp:codex': 'Codex',
  'mcp:copilot': 'GitHub Copilot',
  'mcp:cursor': 'Cursor',
  'mcp:opencode': 'OpenCode',
};

export function getMcpActivitySourceName(source?: null | string): string | null {
  return source ? (MCP_SOURCE_NAMES[source] ?? null) : null;
}
