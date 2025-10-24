import type {LocationDescriptor} from 'history';

import type {Block, ToolLink} from './types';

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
    const truncatedQuestion =
      question.length > 75 ? question.slice(0, 75) + '...' : question;
    return isLoading
      ? `Querying spans: '${truncatedQuestion}'`
      : `Queried spans: '${truncatedQuestion}'`;
  },

  get_trace_waterfall: (args, isLoading) => {
    const traceId = args.trace_id || '';
    const spanId = args.span_id;
    if (spanId) {
      return isLoading
        ? `Digging into span ${spanId.slice(0, 8)}...`
        : `Dug into span ${spanId.slice(0, 8)}`;
    }
    return isLoading
      ? `Viewing waterfall for trace ${traceId.slice(0, 8)}...`
      : `Viewed waterfall for trace ${traceId.slice(0, 8)}`;
  },

  get_issue_details: (args, isLoading) => {
    const issueId = args.issue_id || '';
    const selectedEvent = args.selected_event;
    if (selectedEvent && selectedEvent !== 'recommended') {
      return isLoading
        ? `Inspecting issue ${issueId} (${selectedEvent} event)...`
        : `Inspected issue ${issueId} (${selectedEvent} event)`;
    }
    return isLoading ? `Inspecting issue ${issueId}...` : `Inspected issue ${issueId}`;
  },

  code_search: (args, isLoading) => {
    const repoName = args.repo_name || 'repository';
    const mode = args.mode || 'search';
    const path = args.path;
    const pattern = args.pattern;

    switch (mode) {
      case 'read_file':
        if (path) {
          const truncatedPath = path.length > 50 ? path.slice(0, 50) + '...' : path;
          return isLoading
            ? `Reading ${truncatedPath} from ${repoName}...`
            : `Read ${truncatedPath} from ${repoName}`;
        }
        return isLoading
          ? `Reading file from ${repoName}...`
          : `Read file from ${repoName}`;

      case 'find_files':
        if (pattern) {
          const truncatedPattern =
            pattern.length > 40 ? pattern.slice(0, 40) + '...' : pattern;
          return isLoading
            ? `Finding files matching '${truncatedPattern}' in ${repoName}...`
            : `Found files matching '${truncatedPattern}' in ${repoName}`;
        }
        return isLoading
          ? `Finding files in ${repoName}...`
          : `Found files in ${repoName}`;

      case 'search_content':
        if (pattern) {
          const truncatedPattern =
            pattern.length > 40 ? pattern.slice(0, 40) + '...' : pattern;
          return isLoading
            ? `Searching for '${truncatedPattern}' in ${repoName}...`
            : `Searched for '${truncatedPattern}' in ${repoName}`;
        }
        return isLoading
          ? `Searching code in ${repoName}...`
          : `Searched code in ${repoName}`;

      default:
        return isLoading
          ? `Searching code in ${repoName}...`
          : `Searched code in ${repoName}`;
    }
  },

  git_search: (args, isLoading) => {
    const repoName = args.repo_name || 'repository';
    const sha = args.sha;
    const filePath = args.file_path;
    const startDate = args.start_date;
    const endDate = args.end_date;

    if (sha) {
      const shortSha = sha.slice(0, 7);
      return isLoading
        ? `Digging up commit ${shortSha} from ${repoName}...`
        : `Dug up commit ${shortSha} from ${repoName}`;
    }

    // Build date range string if dates are provided
    let dateRangeStr = '';
    if (startDate || endDate) {
      if (startDate && endDate) {
        dateRangeStr = ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        dateRangeStr = ` since ${startDate}`;
      } else if (endDate) {
        dateRangeStr = ` until ${endDate}`;
      }
    }

    if (filePath) {
      const truncatedPath =
        filePath.length > 40 ? filePath.slice(0, 40) + '...' : filePath;
      return isLoading
        ? `Excavating commits affecting '${truncatedPath}'${dateRangeStr} in ${repoName}...`
        : `Excavated commits affecting '${truncatedPath}'${dateRangeStr} in ${repoName}`;
    }

    return isLoading
      ? `Excavating commit history${dateRangeStr} in ${repoName}...`
      : `Excavated commit history${dateRangeStr} in ${repoName}`;
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

/**
 * Build a URL/LocationDescriptor for a tool link based on its kind and params
 */
export function buildToolLinkUrl(
  toolLink: ToolLink,
  orgSlug: string
): LocationDescriptor | null {
  switch (toolLink.kind) {
    case 'trace_explorer_query': {
      const {query, stats_period, y_axes, group_by, sort, mode} = toolLink.params;

      // Transform backend params to frontend format
      const queryParams: Record<string, any> = {
        query: query || '',
        project: null,
      };

      const aggregateFields: any[] = [];
      if (stats_period) {
        queryParams.statsPeriod = stats_period;
      }
      if (y_axes) {
        const axes = Array.isArray(y_axes) ? y_axes : [y_axes];
        const stringifiedAxes = axes.map(axis => JSON.stringify(axis));
        queryParams.visualize = stringifiedAxes;
        queryParams.yAxes = stringifiedAxes;
        aggregateFields.push(JSON.stringify({yAxes: axes}));
      }
      if (group_by) {
        const groupByValue = Array.isArray(group_by) ? group_by[0] : group_by;
        queryParams.groupBy = groupByValue;
        aggregateFields.push(JSON.stringify({groupBy: groupByValue}));
      }
      if (sort) {
        queryParams.sort = sort;
      }
      if (mode) {
        queryParams.mode = mode === 'aggregates' ? 'aggregate' : 'samples';
      }

      if (aggregateFields.length > 0) {
        queryParams.aggregateField = aggregateFields;
      }

      return {
        pathname: `/organizations/${orgSlug}/traces/`,
        query: queryParams,
      };
    }
    case 'get_trace_waterfall': {
      const {trace_id, span_id, timestamp} = toolLink.params;
      if (!trace_id) {
        return null;
      }

      const pathname = `/explore/traces/trace/${trace_id}/`;
      const query: Record<string, string> = {};

      if (span_id) {
        query.node = `span-${span_id}`;
      }

      if (timestamp) {
        query.timestamp = timestamp;
      }

      return {
        pathname,
        query,
      };
    }
    case 'get_issue_details': {
      const {event_id, issue_id} = toolLink.params;

      return {pathname: `/issues/${issue_id}/events/${event_id}/`};
    }
    default:
      return null;
  }
}
