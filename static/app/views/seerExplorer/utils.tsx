import type {LocationDescriptor} from 'history';

import {LOGS_QUERY_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {Block, ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';

/**
 * Tool formatter function type.
 * Takes parsed args, loading state, and optional tool link metadata.
 * Implement one for each tool that needs custom display.
 */
type ToolFormatter = (
  args: Record<string, any>,
  isLoading: boolean,
  toolLinkParams?: Record<string, any> | null
) => string;

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
    return isLoading ? `Tracing the flow of ${title}...` : `Traced the flow of ${title}`;
  },

  google_search: (args, isLoading) => {
    const question = args.question || 'query';
    return isLoading ? `Googling '${question}'...` : `Googled '${question}'`;
  },

  telemetry_live_search: (args, isLoading) => {
    const question = args.question || 'data';
    const dataset = args.dataset || 'spans';
    const projectSlugs = args.project_slugs;

    const projectInfo =
      projectSlugs && projectSlugs.length > 0 ? ` in ${projectSlugs.join(', ')}` : '';

    if (dataset === 'issues') {
      return isLoading
        ? `Searching for issues${projectInfo}: '${question}'...`
        : `Searched for issues${projectInfo}: '${question}'`;
    }

    if (dataset === 'errors') {
      return isLoading
        ? `Searching for errors${projectInfo}: '${question}'...`
        : `Searched for errors${projectInfo}: '${question}'`;
    }

    if (dataset === 'logs') {
      return isLoading
        ? `Querying logs${projectInfo}: '${question}'...`
        : `Queried logs${projectInfo}: '${question}'`;
    }

    // Default to spans
    return isLoading
      ? `Querying spans${projectInfo}: '${question}'...`
      : `Queried spans${projectInfo}: '${question}'`;
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
    if (selectedEvent) {
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
          return isLoading
            ? `Reading ${path} from ${repoName}...`
            : `Read ${path} from ${repoName}`;
        }
        return isLoading
          ? `Reading file from ${repoName}...`
          : `Read file from ${repoName}`;

      case 'find_files':
        if (pattern) {
          return isLoading
            ? `Finding files matching '${pattern}' in ${repoName}...`
            : `Found files matching '${pattern}' in ${repoName}`;
        }
        return isLoading
          ? `Finding files in ${repoName}...`
          : `Found files in ${repoName}`;

      case 'search_content':
        if (pattern) {
          return isLoading
            ? `Searching for '${pattern}' in ${repoName}...`
            : `Searched for '${pattern}' in ${repoName}`;
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
      return isLoading
        ? `Excavating commits affecting '${filePath}'${dateRangeStr} in ${repoName}...`
        : `Excavated commits affecting '${filePath}'${dateRangeStr} in ${repoName}`;
    }

    return isLoading
      ? `Excavating commit history${dateRangeStr} in ${repoName}...`
      : `Excavated commit history${dateRangeStr} in ${repoName}`;
  },

  get_replay_details: (args, isLoading) => {
    const replayId = args.replay_id || '';
    const shortReplayId = replayId.slice(0, 8);
    return isLoading
      ? `Watching replay ${shortReplayId}...`
      : `Watched replay ${shortReplayId}`;
  },

  get_profile_flamegraph: (args, isLoading) => {
    const profileId = args.profile_id || '';
    const shortProfileId = profileId.slice(0, 8);
    return isLoading
      ? `Sampling profile ${shortProfileId}...`
      : `Sampled profile ${shortProfileId}`;
  },

  get_metric_attributes: (args, isLoading) => {
    const metricName = args.metric_name || '';
    const traceId = args.trace_id || '';
    const shortTraceId = traceId.slice(0, 8);
    return isLoading
      ? `Double-clicking on metric '${metricName}' in trace ${shortTraceId}...`
      : `Double-clicked on metric '${metricName}' in trace ${shortTraceId}`;
  },

  get_log_attributes: (args, isLoading) => {
    const message = args.log_message_substring || '';
    const traceId = args.trace_id || '';
    const shortTraceId = traceId.slice(0, 8);
    return isLoading
      ? `Examining logs matching '*${message.slice(0, 20)}*' in trace ${shortTraceId}...`
      : `Examined logs matching '*${message.slice(0, 20)}*' in trace ${shortTraceId}`;
  },

  code_file_edit: (args, isLoading, toolLinkParams) => {
    const repoName = args.repo_name || 'repository';
    const path = args.path || 'file';

    if (toolLinkParams?.empty_results) {
      return `Edit to ${path} in ${repoName} was rejected`;
    }
    if (toolLinkParams?.pending_approval) {
      return `Edit to ${path} in ${repoName} is pending your approval`;
    }
    return isLoading
      ? `Editing ${path} in ${repoName}...`
      : `Edited ${path} in ${repoName}`;
  },

  code_file_write: (args, isLoading, toolLinkParams) => {
    const repoName = args.repo_name || 'repository';
    const path = args.path || 'file';
    const content = args.content;

    // Determine action based on content
    const isDelete = content === '';
    const action = isDelete ? 'Delete' : 'Write';
    const actionPast = isDelete ? 'Deleted' : 'Wrote';
    const actionPresent = isDelete ? 'Deleting' : 'Writing';
    const actionPending = isDelete ? 'Delete' : 'Write';

    if (toolLinkParams?.empty_results) {
      return `${action} to ${path} in ${repoName} was rejected`;
    }
    if (toolLinkParams?.pending_approval) {
      return `${actionPending} to ${path} in ${repoName} is pending your approval`;
    }

    return isLoading
      ? `${actionPresent} ${path} in ${repoName}...`
      : `${actionPast} ${path} in ${repoName}`;
  },

  search_sentry_docs: (args, isLoading) => {
    const question = args.question || 'query';
    return isLoading
      ? `Scouring Sentry docs: '${question}'...`
      : `Scoured Sentry docs: '${question}'`;
  },

  todo_write: (args, isLoading, toolLinkParams) => {
    if (isLoading) {
      const count = args.todos?.length || 0;
      return count === 1 ? 'Updating todo list...' : `Updating ${count} todos...`;
    }
    // Use the summary from metadata if available
    return toolLinkParams?.summary || 'Updated todo list';
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
 * Tool links are aligned with tool calls by index and contain metadata like rejection status.
 */
export function getToolsStringFromBlock(block: Block): string[] {
  const tools: string[] = [];
  const isLoading = block.loading ?? false;
  const toolCalls = block.message.tool_calls || [];
  const toolLinks = block.tool_links || [];

  for (let i = 0; i < toolCalls.length; i++) {
    const tool = toolCalls[i] as ToolCall;
    const toolLink = toolLinks[i];
    const formatter = TOOL_FORMATTERS[tool.function];

    if (formatter) {
      // Use custom formatter with tool link params for metadata like rejection status
      const args = parseToolArgs(tool.args);
      tools.push(formatter(args, isLoading, toolLink?.params));
    } else {
      // Fall back to generic message
      const verb = isLoading ? 'Using' : 'Used';
      tools.push(`${verb} ${tool.function} tool`);
    }
  }

  return tools;
}

/**
 * Converts issue short IDs in text to markdown links.
 * Examples: INTERNAL-4K, JAVASCRIPT-2SDJ, PROJECT-1
 * Excludes IDs that are already inside markdown code blocks, links, or URLs.
 */
function linkifyIssueShortIds(text: string): string {
  // Pattern matches: PROJECT_SLUG-SHORT_ID (uppercase only, case-sensitive)
  // Requires at least 2 chars before hyphen and 1+ chars after
  // First segment must contain at least one uppercase letter (all letters must be uppercase)
  const shortIdPattern = /\b((?:[A-Z][A-Z0-9_]{1,}|[0-9_]+[A-Z][A-Z0-9_]*)-[A-Z0-9]+)\b/g;

  // Track positions that should be excluded (inside code blocks, links, or URLs)
  const excludedRanges: Array<{end: number; start: number}> = [];

  // Find all markdown code blocks (inline and block)
  const codeBlockPattern = /(`+)([^`]+)\1|```[\s\S]*?```/g;
  for (const codeMatch of text.matchAll(codeBlockPattern)) {
    excludedRanges.push({
      end: codeMatch.index + codeMatch[0].length,
      start: codeMatch.index,
    });
  }
  // Find all markdown links [text](url)
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const linkMatch of text.matchAll(markdownLinkPattern)) {
    excludedRanges.push({
      end: linkMatch.index + linkMatch[0].length,
      start: linkMatch.index,
    });
  }
  // Find all URLs (http://, https://, or starting with /)
  const urlPattern = /(https?:\/\/[^\s]+|\/[^\s)]+)/g;
  for (const urlMatch of text.matchAll(urlPattern)) {
    excludedRanges.push({
      end: urlMatch.index + urlMatch[0].length,
      start: urlMatch.index,
    });
  }

  // Sort ranges by start position for efficient checking
  excludedRanges.sort((a, b) => a.start - b.start);

  // Helper function to check if a position is within any excluded range
  const isExcluded = (pos: number): boolean => {
    return excludedRanges.some(range => pos >= range.start && pos < range.end);
  };

  // Replace matches, but skip those in excluded ranges
  return text.replace(shortIdPattern, (idMatch, _content, offset) => {
    if (isExcluded(offset)) {
      return idMatch;
    }
    return `[${idMatch}](/issues/${idMatch}/)`;
  });
}

/**
 * Post-processes markdown text from LLM responses.
 * Applies various transformations to enhance the text with links and formatting.
 * Add new processing rules to this function as needed.
 */
export function postProcessLLMMarkdown(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  let processed = text;

  // Convert issue short IDs to clickable links
  processed = linkifyIssueShortIds(processed);

  // Add more processing rules here as needed

  return processed;
}

/**
 * Build a URL/LocationDescriptor for a tool link based on its kind and params
 */
export function buildToolLinkUrl(
  toolLink: ToolLink,
  orgSlug: string,
  projects?: Array<{id: string; slug: string}>
): LocationDescriptor | null {
  switch (toolLink.kind) {
    case 'telemetry_live_search': {
      const {dataset, query, stats_period, project_slugs, sort} = toolLink.params;

      if (dataset === 'issues') {
        // Build URL for issues search
        const queryParams: Record<string, any> = {
          query: query || '',
        };

        // If project_slugs is provided, look up the project IDs
        if (project_slugs && project_slugs.length > 0 && projects) {
          const projectIds = project_slugs
            .map((slug: string) => projects.find(p => p.slug === slug)?.id)
            .filter((id: string | undefined) => id !== undefined);
          if (projectIds.length > 0) {
            queryParams.project = projectIds;
          }
        }

        if (stats_period) {
          queryParams.statsPeriod = stats_period;
        }

        if (sort) {
          queryParams.sort = sort;
        }

        return {
          pathname: `/organizations/${orgSlug}/issues/`,
          query: queryParams,
        };
      }

      if (dataset === 'errors') {
        const queryParams: Record<string, any> = {
          dataset: 'errors',
          queryDataset: 'error-events',
          query: query || '',
          project: null,
        };

        if (stats_period) {
          queryParams.statsPeriod = stats_period;
        }

        // If project_slugs is provided, look up the project IDs
        if (project_slugs && project_slugs.length > 0 && projects) {
          const projectIds = project_slugs
            .map((slug: string) => projects.find(p => p.slug === slug)?.id)
            .filter((id: string | undefined) => id !== undefined);
          if (projectIds.length > 0) {
            queryParams.project = projectIds;
          }
        }

        const {y_axes} = toolLink.params;
        if (y_axes) {
          queryParams.yAxis = y_axes;
        }

        if (sort) {
          queryParams.sort = sort;
        }

        return {
          pathname: `/organizations/${orgSlug}/explore/discover/homepage/`,
          query: queryParams,
        };
      }

      if (dataset === 'logs') {
        const queryParams: Record<string, any> = {
          [LOGS_QUERY_KEY]: query || '',
          project: null,
        };

        if (stats_period) {
          queryParams.statsPeriod = stats_period;
        }

        // If project_slugs is provided, look up the project IDs
        if (project_slugs && project_slugs.length > 0 && projects) {
          const projectIds = project_slugs
            .map((slug: string) => projects.find(p => p.slug === slug)?.id)
            .filter((id: string | undefined) => id !== undefined);
          if (projectIds.length > 0) {
            queryParams.project = projectIds;
          }
        }

        if (sort) {
          queryParams[LOGS_SORT_BYS_KEY] = sort;
        }

        return {
          pathname: `/organizations/${orgSlug}/explore/logs/`,
          query: queryParams,
        };
      }

      // Default to spans (traces) search
      const {y_axes, group_by, mode} = toolLink.params;

      const queryParams: Record<string, any> = {
        query: query || '',
        project: null,
      };

      // If project_slugs is provided, look up the project IDs
      if (project_slugs && project_slugs.length > 0 && projects) {
        const projectIds = project_slugs
          .map((slug: string) => projects.find(p => p.slug === slug)?.id)
          .filter((id: string | undefined) => id !== undefined);
        if (projectIds.length > 0) {
          queryParams.project = projectIds;
        }
      }

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
    case 'get_replay_details': {
      const {replay_id} = toolLink.params;
      if (!replay_id) {
        return null;
      }

      return {
        pathname: `/organizations/${orgSlug}/replays/${replay_id}/`,
      };
    }
    case 'get_profile_flamegraph': {
      const {profile_id, project_id, is_continuous, start_ts, end_ts, thread_id} =
        toolLink.params;
      if (!profile_id || !project_id) {
        return null;
      }

      // Look up project slug from project_id
      const project = projects?.find(p => p.id === String(project_id));
      if (!project) {
        return null;
      }

      if (is_continuous) {
        // Continuous profiles need start/end timestamps as query params
        if (!start_ts || !end_ts) {
          return null;
        }

        // Convert Unix timestamps to ISO date strings
        const startDate = new Date(start_ts * 1000).toISOString();
        const endDate = new Date(end_ts * 1000).toISOString();

        return {
          pathname: `/explore/profiling/profile/${project.slug}/flamegraph/`,
          query: {
            start: startDate,
            end: endDate,
            profilerId: profile_id,
            ...(thread_id && {tid: thread_id}),
          },
        };
      }

      // Transaction profiles use profile_id in the path
      return {
        pathname: `/organizations/${orgSlug}/explore/profiling/profile/${project.slug}/${profile_id}/flamegraph/`,
        ...(thread_id && {query: {tid: thread_id}}),
      };
    }
    case 'get_log_attributes': {
      const {trace_id} = toolLink.params;
      if (!trace_id) {
        return null;
      }

      // TODO: Currently no way to pass substring filter to this page, update with params.log_message_substring when it's supported.
      return {
        pathname: `/organizations/${orgSlug}/explore/logs/trace/${trace_id}/`,
        query: {tab: 'logs'},
      };
    }
    case 'get_metric_attributes': {
      const {trace_id} = toolLink.params;
      if (!trace_id) {
        return null;
      }

      // TODO: Currently no way to pass name filter to this page, update with params.metric_name when it's supported.
      return {
        pathname: `/organizations/${orgSlug}/explore/metrics/trace/${trace_id}/`,
        query: {tab: 'metrics'},
      };
    }
    default:
      return null;
  }
}
