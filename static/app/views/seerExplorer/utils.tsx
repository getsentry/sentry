import type {Block} from './types';

/**
 * Tool formatter function type.
 * Takes parsed args and loading state, returns the display message.
 * Implement one for each tool that needs custom display.
 */
type ToolFormatter = (args: Record<string, any>, isLoading: boolean) => string;

/**
 * Registry of custom tool formatters.
 * Add new tools here to customize their display.
 */
const TOOL_FORMATTERS: Record<string, ToolFormatter> = {
  telemetry_index_list_nodes: (args, isLoading) => {
    const keyword = args.keyword || 'items';
    return isLoading ? `Scanning for ${keyword}...` : `Scanned for ${keyword}`;
  },

  telemetry_index_dependencies: (args, isLoading) => {
    const title = args.title || 'item';
    const truncatedTitle = title.length > 75 ? title.slice(0, 75) + '...' : title;
    return isLoading
      ? `Tracing the flow of ${truncatedTitle}...`
      : `Traced the flow of ${truncatedTitle}`;
  },

  google_search: (args, isLoading) => {
    const question = args.question || 'query';
    return isLoading ? `Googling '${question}'...` : `Googled '${question}'`;
  },

  trace_explorer_query: (args, isLoading) => {
    const question = args.question || 'spans';
    return isLoading ? `Querying spans: '${question}'` : `Queried spans: '${question}'`;
  },
};

/**
 * Parse JSON args safely, returning empty object on failure
 */
function parseToolArgs(argsString: string): Record<string, any> {
  try {
    return JSON.parse(argsString);
  } catch {
    return {};
  }
}

/**
 * Get display strings for all tool calls in a block.
 * Uses custom formatters from TOOL_FORMATTERS registry, falls back to generic message.
 */
export function getToolsStringFromBlock(block: Block): string[] {
  const tools: string[] = [];
  const isLoading = block.loading ?? false;

  for (const tool of block.message.tool_calls || []) {
    const formatter = TOOL_FORMATTERS[tool.function];

    if (formatter) {
      // Use custom formatter
      const args = parseToolArgs(tool.args);
      tools.push(formatter(args, isLoading));
    } else {
      // Fall back to generic message
      const verb = isLoading ? 'Using' : 'Used';
      tools.push(`${verb} ${tool.function} tool`);
    }
  }

  return tools;
}
