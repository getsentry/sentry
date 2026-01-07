import {useCallback, useEffect, useRef, useState} from 'react';
import type {LocationDescriptor} from 'history';
import queryString from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useRoutes} from 'sentry/utils/useRoutes';
import {
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {
  Block,
  ToolCall,
  ToolLink,
  ToolResult,
} from 'sentry/views/seerExplorer/types';

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

export const makeSeerExplorerQueryKey = (
  orgSlug: string,
  runId?: number
): ApiQueryKey => [
  `/organizations/${orgSlug}/seer/explorer-chat/${runId ? `${runId}/` : ''}`,
  {},
];

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
    const {issue_id, event_id, start, end} = args;

    if (issue_id) {
      if (start && end) {
        return isLoading
          ? `Inspecting issue ${issue_id} between ${start} to ${end}...`
          : `Inspected issue ${issue_id} between ${start} to ${end}`;
      }
      return isLoading
        ? `Inspecting issue ${issue_id}...`
        : `Inspected issue ${issue_id}`;
    }

    if (event_id) {
      return isLoading
        ? `Inspecting event ${event_id}...`
        : `Inspected event ${event_id}`;
    }

    // Should not happen unless there's a bug.
    return isLoading ? `Inspecting issue...` : `Inspected issue`;
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

  ask_user_question: (args, isLoading, toolLinkParams) => {
    const count = Array.isArray(args.questions) ? args.questions.length : 1;
    const questionWord = count === 1 ? 'question' : 'questions';

    // Show pending state when awaiting user response
    if (toolLinkParams?.pending_question) {
      return `Asking ${count} ${questionWord}...`;
    }

    return isLoading
      ? `Asking ${count} ${questionWord}...`
      : `Asked ${count} ${questionWord}`;
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
    } else if (tool.function.startsWith('artifact_write_')) {
      // Handle artifact_write_<artifact_name> tools
      const artifactName = tool.function
        .replace('artifact_write_', '')
        .replace(/_/g, ' ');
      tools.push(
        isLoading
          ? `Submitting ${artifactName} artifact...`
          : `Submitted ${artifactName} artifact`
      );
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
 * Simulates the keyboard shortcut to toggle the Seer Explorer panel.
 * This dispatches a keyboard event that matches the Cmd+/ (Mac) or Ctrl+/ (non-Mac) shortcut.
 */
export function toggleSeerExplorerPanel(): void {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const keyboardEvent = new KeyboardEvent('keydown', {
    key: '/',
    code: 'Slash',
    keyCode: 191,
    which: 191,
    metaKey: isMac,
    ctrlKey: !isMac,
    bubbles: true,
  } as KeyboardEventInit);
  document.dispatchEvent(keyboardEvent);
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
      const {dataset, project_slugs, query, sort, stats_period, start, end} =
        toolLink.params;

      const queryParams: Record<string, any> = {
        query: query || '',
        project: null,
      };
      if (stats_period) {
        queryParams.statsPeriod = stats_period;
      }
      if (sort) {
        queryParams.sort = sort;
      }

      // page filter expects no timezone (treated as UTC) or +HH:MM offset.
      if (start) {
        queryParams.start = start.replace(/Z$/, '');
      }
      if (end) {
        queryParams.end = end.replace(/Z$/, '');
      }

      // If project_slugs is provided, look up the IDs and include them in qparams
      if (project_slugs && project_slugs.length > 0 && projects) {
        const projectIds = project_slugs
          .map((slug: string) => projects.find(p => p.slug === slug)?.id)
          .filter((id: string | undefined) => id !== undefined);
        if (projectIds.length > 0) {
          queryParams.project = projectIds;
        }
      }

      if (dataset === 'issues') {
        return {
          pathname: `/organizations/${orgSlug}/issues/`,
          query: queryParams,
        };
      }

      if (dataset === 'errors') {
        queryParams.dataset = 'errors';
        queryParams.queryDataset = 'error-events';

        const {y_axes, group_by} = toolLink.params;
        if (y_axes) {
          queryParams.yAxis = y_axes;
        }

        // In Discover, group_by values become selected columns (field param)
        // along with the y_axes aggregates
        const fields: string[] = [];
        if (group_by) {
          const groupByArray = Array.isArray(group_by) ? group_by : [group_by];
          fields.push(...groupByArray);
        }
        if (y_axes) {
          const yAxesArray = Array.isArray(y_axes) ? y_axes : [y_axes];
          fields.push(...yAxesArray);
        }
        if (fields.length > 0) {
          queryParams.field = fields;
        }

        // Discover sort strips parentheses from aggregates: -count() -> -count
        if (queryParams.sort) {
          queryParams.sort = queryParams.sort.replace(/\(\)/g, '');
        }

        return {
          pathname: `/organizations/${orgSlug}/explore/discover/homepage/`,
          query: queryParams,
        };
      }

      if (dataset === 'logs') {
        queryParams[LOGS_QUERY_KEY] = query || '';
        delete queryParams.query;

        if (sort) {
          queryParams[LOGS_SORT_BYS_KEY] = sort;
          delete queryParams.sort;
        }

        const {group_by, mode} = toolLink.params;
        if (group_by) {
          const groupByArray = Array.isArray(group_by) ? group_by : [group_by];
          queryParams[LOGS_GROUP_BY_KEY] = groupByArray;
        }
        if (mode) {
          queryParams.mode = mode === 'aggregates' ? 'aggregate' : 'samples';
        }

        return {
          pathname: `/organizations/${orgSlug}/explore/logs/`,
          query: queryParams,
        };
      }

      // Default to spans (traces) search
      const {y_axes, group_by, mode} = toolLink.params;
      const aggregateFields: string[] = [];

      if (y_axes) {
        const axes = Array.isArray(y_axes) ? y_axes : [y_axes];
        const stringifiedAxes = axes.map(axis => JSON.stringify(axis));
        queryParams.visualize = stringifiedAxes;
        queryParams.yAxes = stringifiedAxes;
        aggregateFields.push(JSON.stringify({yAxes: axes}));
      }
      if (group_by) {
        const groupByArray = Array.isArray(group_by) ? group_by : [group_by];
        // Each groupBy value becomes a separate query param and aggregateField entry
        queryParams.groupBy = groupByArray;
        for (const groupByValue of groupByArray) {
          aggregateFields.push(JSON.stringify({groupBy: groupByValue}));
        }
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

      if (event_id && issue_id) {
        return {pathname: `/issues/${issue_id}/events/${event_id}/`};
      }

      return null;
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

export function getValidToolLinks(
  tool_links: Array<ToolLink | null>,
  tool_results: Array<ToolResult | null>,
  tool_calls: ToolCall[],
  orgSlug: string,
  projects?: Array<{id: string; slug: string}>
) {
  // Get valid tool links sorted by their corresponding tool call indices
  // Also create a mapping from tool call index to sorted link index
  const mappedLinks = tool_links
    .map((link, idx) => {
      if (!link) {
        return null;
      }

      // Don't show links for tools that returned errors, but do show for empty results
      if (link.params?.is_error === true) {
        return null;
      }

      // get tool_call_id from tool_results, which we expect to be aligned with tool_links.
      const toolCallId = tool_results[idx]?.tool_call_id;
      const toolCallIndex = tool_calls.findIndex(call => call.id === toolCallId);
      const canBuildUrl = buildToolLinkUrl(link, orgSlug, projects) !== null;

      if (toolCallIndex !== undefined && toolCallIndex >= 0 && canBuildUrl) {
        return {link, toolCallIndex};
      }
      return null;
    })
    .filter(item => item !== null)
    .sort((a, b) => a.toolCallIndex - b.toolCallIndex);

  // Create mapping from tool call index to sorted link index
  const toolCallToLinkMap = new Map<number, number>();
  mappedLinks.forEach((item, sortedIndex) => {
    toolCallToLinkMap.set(item.toolCallIndex, sortedIndex);
  });

  return {
    sortedToolLinks: mappedLinks.map(item => item.link),
    toolCallToLinkIndexMap: toolCallToLinkMap,
  };
}

/**
 * Returns a callback to get the route string (normalized path) of the current page for analytics, e.g. /issues/:groupId/.
 * This callback is stable to avoid triggering analytics and re-renders when the location changes.
 */
export function usePageReferrer(): {getPageReferrer: () => string} {
  // Track the normalized path of the current page (e.g. /issues/:groupId/) for analytics.
  const routes = useRoutes();
  const routeString = getRouteStringFromRoutes(routes);
  const routeStringRef = useRef(routeString);

  useEffect(() => {
    routeStringRef.current = routeString;
  }, [routeString]);

  // Must remain stable.
  const getPageReferrer = useCallback(() => routeStringRef.current, []);

  return {getPageReferrer};
}

export function useCopySessionDataToClipboard({
  blocks,
  organization,
  projects,
  enabled,
}: {
  blocks: Block[];
  enabled: boolean;
  organization: Organization | null;
  projects?: Array<{id: string; slug: string}>;
}) {
  const [isError, setIsError] = useState(false);

  const copySessionToClipboard = useCallback(async () => {
    if (!enabled || !organization || !blocks) {
      return;
    }
    setIsError(false);
    try {
      await navigator.clipboard.writeText(
        formatSessionData(blocks, organization.slug, projects)
      );
      addSuccessMessage('Copied conversation to clipboard');
    } catch (err) {
      setIsError(true);
      addErrorMessage('Failed to copy conversation to clipboard');
    }

    trackAnalytics('seer.explorer.session_copied_to_clipboard', {organization});
  }, [enabled, blocks, organization, projects]);

  return {copySessionToClipboard, isError};
}

function formatSessionData(
  blocks: Block[],
  orgSlug: string,
  projects?: Array<{id: string; slug: string}>
): string {
  const formatBlock = (block: Block): string => {
    const {message, timestamp, tool_links, tool_results} = block;

    const {content: messageContent, role, tool_calls, thinking_content} = message;

    const {sortedToolLinks, toolCallToLinkIndexMap} = getValidToolLinks(
      tool_links || [],
      tool_results || [],
      tool_calls || [],
      orgSlug,
      projects
    );

    const toolCallsWithLinks: Array<{
      metadata: Record<string, any> | null;
      tool_call: ToolCall;
      url: string | null;
    }> = (tool_calls || []).map((tool_call, idx) => {
      // Build URL if a valid tool link exists for this call.
      const validLinkIdx = toolCallToLinkIndexMap.get(idx);
      const validLink =
        validLinkIdx === undefined ? null : (sortedToolLinks[validLinkIdx] ?? null);
      const location = validLink ? buildToolLinkUrl(validLink, orgSlug, projects) : null;
      const url = location ? locationToUrl(location) : null;

      // Get metadata from raw tool_links array.
      const metadata = tool_links?.[idx]?.params || null;

      return {metadata, tool_call, url};
    });

    const lines: string[] = [];
    lines.push(`# ${role.toUpperCase()} ${timestamp}`);
    if (messageContent) {
      lines.push(messageContent);
    }
    if (thinking_content) {
      lines.push('');
      lines.push('## THINKING CONTENT');
      lines.push(thinking_content);
    }

    if (toolCallsWithLinks.length > 0) {
      lines.push('');
      lines.push('## TOOL CALLS');
      toolCallsWithLinks.forEach((item, idx) => {
        const isError = !!item.metadata?.is_error;
        const emptyResults = !!item.metadata?.empty_results;
        const status = isError ? 'ERRORED' : emptyResults ? 'EMPTY RESULTS' : 'SUCCESS';

        lines.push(`${item.tool_call.function} (${status}) (${item.tool_call.id}):`);
        lines.push(`args: ${item.tool_call.args}`);
        if (item.url) {
          lines.push(`URL: ${item.url}`);
        }

        if (idx < toolCallsWithLinks.length - 1) {
          lines.push('');
        }
      });
    }
    lines.push('');
    return lines.join('\n');
  };

  return blocks
    .map(block => formatBlock(block))
    .join('\n--------------------------------------------------\n\n');
}

function locationToUrl(location: LocationDescriptor): string | null {
  if (typeof location === 'string') {
    const hasOrigin = /^https?:\/\//.test(location);
    return hasOrigin ? location : `${window.location.origin}${location}`;
  }

  const {pathname = '', hash, query} = location;
  const base = `${window.location.origin}${pathname}`;

  const queryPart = query ? `?${queryString.stringify(query)}` : '';

  const hashPart = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';

  return `${base}${queryPart}${hashPart}`;
}

export const RUN_ID_QUERY_PARAM = 'explorerRunId';
