import {useCallback, useEffect, useRef, useState} from 'react';
import {useMatches} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import type {LocationDescriptor} from 'history';
import queryString from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {UseFeedbackOptions} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';
import {resolveLink, subjectFromToolLink} from 'sentry/views/seerExplorer/links';
import type {
  Artifact,
  Block,
  SeerExplorerRunId,
  SeerExplorerSidebarPosition,
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
  runId: SeerExplorerRunId | null
): ApiQueryKey => [
  runId
    ? getApiUrl('/organizations/$organizationIdOrSlug/seer/explorer-chat/$runId/', {
        path: {organizationIdOrSlug: orgSlug, runId},
      })
    : getApiUrl('/organizations/$organizationIdOrSlug/seer/explorer-chat/', {
        path: {organizationIdOrSlug: orgSlug},
      }),

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

  telemetry_live_search: (args, isLoading, resultMetadata) => {
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

    if (dataset === 'metrics' || dataset === 'tracemetrics') {
      return isLoading
        ? `Querying metrics${projectInfo}: '${question}'...`
        : `Queried metrics${projectInfo}: '${question}'`;
    }

    // Default to spans dataset
    return isLoading
      ? `Querying spans${projectInfo}: '${question}'...`
      : resultMetadata?.mode === 'traces'
        ? `Queried traces${projectInfo}: '${question}'...`
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

  get_issue_details: (args, isLoading, resultMetadata) => {
    const {issue_id, start, end, event_id} = args;

    if (event_id) {
      // For backwards compatibility. event_id arg only present in an older version (issue_and_event_details)
      return isLoading
        ? `Analyzing event ${event_id.slice(0, 8)}...`
        : `Analyzed event ${event_id.slice(0, 8)}`;
    }

    if (issue_id) {
      if (start && end) {
        return isLoading
          ? `Inspecting issue ${issue_id} between ${start} to ${end}...`
          : `Inspected issue ${resultMetadata?.short_id || issue_id} between ${start} to ${end}`;
      }
      return isLoading
        ? `Inspecting issue ${issue_id}...`
        : `Inspected issue ${resultMetadata?.short_id || issue_id}`;
    }

    // shouldn't happen (issue_id required)
    return isLoading ? 'Inspecting issue...' : 'Inspected issue';
  },

  get_event_details: (args, isLoading, resultMetadata) => {
    const {event_id, issue_id, start, end} = args;

    // event ID mode
    if (event_id) {
      return isLoading
        ? `Analyzing event ${event_id.slice(0, 8)}...`
        : `Analyzed event ${event_id.slice(0, 8)}`;
    }

    // recommended event mode
    if (issue_id) {
      if (start && end) {
        return isLoading
          ? `Analyzing recommended event for issue ${issue_id}, sampled from ${start} to ${end}...`
          : `Analyzed recommended event for ${resultMetadata?.short_id || `issue ${issue_id}`}, sampled from ${start} to ${end}`;
      }
      return isLoading
        ? `Analyzing recommended event for issue ${issue_id}...`
        : `Analyzed recommended event for ${resultMetadata?.short_id || `issue ${issue_id}`}`;
    }

    // shouldn't happen (either event_id or issue_id required)
    return isLoading ? 'Analyzing event...' : 'Analyzed event';
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

  read_file: (args, isLoading) => {
    const repo = args.repo_name || 'repository';
    const path = args.path || 'file';
    return isLoading ? `Reading ${path} from ${repo}...` : `Read ${path} from ${repo}`;
  },

  edit_file: (args, isLoading) => {
    const repo = args.repo_name || 'repository';
    const path = args.path || 'file';
    return isLoading ? `Editing ${path} in ${repo}...` : `Edited ${path} in ${repo}`;
  },

  write_file: (args, isLoading) => {
    const repo = args.repo_name || 'repository';
    const path = args.path || 'file';
    return isLoading ? `Writing ${path} in ${repo}...` : `Wrote ${path} in ${repo}`;
  },

  bash: (args, isLoading) => {
    if (!args.description || typeof args.description !== 'string') {
      return isLoading ? 'Using bash tool' : 'Used bash tool';
    }
    const description = args.description || '';
    return (description[0] || '').toUpperCase() + args.description.slice(1);
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
  const toolResults = block.tool_results || [];

  const toolLinkByCallId = new Map<string, ToolLink | null>();
  toolResults.forEach((result, idx) => {
    if (result?.tool_call_id) {
      toolLinkByCallId.set(result.tool_call_id, toolLinks[idx] ?? null);
    }
  });

  for (const tool of toolCalls) {
    const toolLink = (tool.id ? toolLinkByCallId.get(tool.id) : undefined) ?? null;
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

export function getValidToolLinks(
  tool_links: Array<ToolLink | null>,
  tool_results: Array<ToolResult | null>,
  tool_calls: ToolCall[],
  organization: Organization,
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
      const toolCallIndex = toolCallId
        ? tool_calls.findIndex(call => call.id === toolCallId)
        : -1;
      const canBuildUrl =
        resolveLink(subjectFromToolLink(link), {organization, projects})?.url !==
        undefined;

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
  const matches = useMatches();
  const routeString = getRouteStringFromRoutes({matches});
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
  status,
  organization,
  projects,
  enabled,
}: {
  blocks: Block[] | undefined;
  enabled: boolean;
  organization: Organization | null;
  status: string | undefined;
  projects?: Array<{id: string; slug: string}>;
}) {
  const [isError, setIsError] = useState(false);

  const copySessionToClipboard = useCallback(async () => {
    if (!enabled || !organization) {
      return;
    }
    setIsError(false);
    try {
      const text = blocks
        ? formatSessionData(blocks, organization, projects)
        : `No data available. Status: ${status ?? 'unknown'}`;
      await navigator.clipboard.writeText(text);
      addSuccessMessage('Copied conversation to clipboard');
    } catch (err) {
      setIsError(true);
      addErrorMessage('Failed to copy conversation to clipboard');
    }

    trackAnalytics('seer.explorer.session_copied_to_clipboard', {organization});
  }, [enabled, blocks, status, organization, projects]);

  return {copySessionToClipboard, isError};
}

function formatSessionData(
  blocks: Block[],
  organization: Organization,
  projects?: Array<{id: string; slug: string}>
): string {
  const formatBlock = (block: Block): string => {
    const {message, timestamp, tool_links, tool_results} = block;

    const {content: messageContent, role, tool_calls, thinking_content} = message;

    const {sortedToolLinks, toolCallToLinkIndexMap} = getValidToolLinks(
      tool_links || [],
      tool_results || [],
      tool_calls || [],
      organization,
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
      const location = validLink
        ? (resolveLink(subjectFromToolLink(validLink), {organization, projects})?.url ??
          null)
        : null;
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
      lines.push('', '## THINKING CONTENT', thinking_content);
    }

    if (toolCallsWithLinks.length > 0) {
      lines.push('', '## TOOL CALLS');
      toolCallsWithLinks.forEach((item, idx) => {
        const isError = !!item.metadata?.is_error;
        const emptyResults = !!item.metadata?.empty_results;
        const status = isError ? 'ERRORED' : emptyResults ? 'EMPTY RESULTS' : 'SUCCESS';

        lines.push(
          `${item.tool_call.function} (${status})${item.tool_call.id ? ` (${item.tool_call.id})` : ''}:`,
          `args: ${item.tool_call.args}`
        );
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

const RUN_ID_QUERY_PARAM = 'explorerRunId';
const RESUME_RUN_QUERY_PARAM = 'explorerRunResume';

export function parseRunIdParam(value: string): SeerExplorerRunId | null {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  return isUUID(value) ? value : null;
}

/**
 * useEffect which listens for run ID query param in the current location. If found, it removes the query param and runs a callback.
 */
export function useSeerExplorerDeepLink({
  callback,
  enabled = true,
}: {
  callback: (runId: SeerExplorerRunId) => void;
  enabled?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const paramValue = location.query?.[RUN_ID_QUERY_PARAM];
    if (!paramValue || typeof paramValue !== 'string') {
      return;
    }

    const runId = parseRunIdParam(paramValue);
    if (runId === null) {
      return;
    }

    const {[RUN_ID_QUERY_PARAM]: _runId, ...restQuery} = location.query ?? {};
    navigate({...location, query: restQuery}, {replace: true});
    callback(runId);
  }, [location, navigate, callback, enabled]);
}

/**
 * Consumes the resume query param in the current location after an out-of-band round-trip (e.g.
 * an OAuth reauth redirect). Once `ready` is true, it runs `onResume` and strips the marker.
 */
export function useSeerExplorerResumeDeepLink({
  onResume,
  ready,
}: {
  onResume: () => void;
  ready: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasResumedRef = useRef(false);

  useEffect(() => {
    if (location.query?.[RESUME_RUN_QUERY_PARAM] !== '1') {
      hasResumedRef.current = false;
      return;
    }
    if (!ready || hasResumedRef.current) {
      return;
    }
    hasResumedRef.current = true;
    onResume();
    const {[RESUME_RUN_QUERY_PARAM]: _resume, ...restQuery} = location.query ?? {};
    navigate({...location, query: restQuery}, {replace: true});
  }, [location, navigate, ready, onResume]);
}

/**
 * Returns the URL of the current window with the run ID query param set.
 */
export function getExplorerUrl(runId: number | string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(RUN_ID_QUERY_PARAM, String(runId));
  return url.toString();
}

/**
 * Returns the relative URL of the current window with the run ID query param set.
 * Pass `resume` to also mark the URL so the explorer continues the run once the
 * user returns from an out-of-band round-trip (e.g. OAuth reauth).
 */
export function getRelativeExplorerUrl(
  runId: number | string,
  {resume = false}: {resume?: boolean} = {}
): string {
  const url = new URL(window.location.href);
  url.searchParams.set(RUN_ID_QUERY_PARAM, String(runId));
  if (resume) {
    url.searchParams.set(RESUME_RUN_QUERY_PARAM, '1');
  }
  return url.pathname + url.search;
}

export function getExplorerFeedbackOptions(
  runId: SeerExplorerRunId | null
): UseFeedbackOptions {
  return {
    formTitle: 'Seer Agent Feedback',
    messagePlaceholder: 'How can we make Seer better for you?',
    tags: {
      'feedback.source': 'seer_explorer',
      'feedback.owner': 'ml-ai',
      ...(runId === null ? {} : {'seer.run_id': runId.toString()}),
      ...(runId === null ? {} : {explorer_url: getExplorerUrl(runId)}),
      ...(runId === null
        ? {}
        : {conversations_url: getConversationsUrlForExternalUse('sentry', runId)}),
    },
  };
}

/**
 * Checks if Seer Explorer is enabled for the organization.
 * Requires the rollout flag and:
 * - 'gen-ai-features' feature flag
 * - Organization has not disabled open membership
 * - Organization has not disabled AI features (hideAiFeatures is false)
 */
export function isSeerExplorerEnabled(organization: Organization | null): boolean {
  if (!organization) {
    return false;
  }

  return (
    organization.openMembership &&
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('seer-explorer')
  );
}

/**
 * Whether Seer Explorer should render as a persistent, resizable split-panel
 * sidebar instead of an overlay drawer.
 */
export function useIsSeerExplorerSidebarEnabled(): boolean {
  const organization = useOrganization({allowNull: true});
  return (
    isSeerExplorerEnabled(organization) &&
    !!organization?.features.includes('seer-explorer-persistent-sidebar')
  );
}

/**
 * localStorage keys for Seer's persisted size in the sidebar split, one per dock
 * orientation (width when docked right, height when docked bottom). We persist
 * *Seer's* size — which is viewport-independent — rather than the content pane's,
 * so Seer keeps a fixed size and the content area flexes as the viewport changes.
 */
export const SEER_EXPLORER_SIDEBAR_SEER_SIZE_KEY = {
  right: 'seer-explorer-sidebar-seer-size:right',
  bottom: 'seer-explorer-sidebar-seer-size:bottom',
} as const;

/** Pixel step used when bucketing layout sizes for analytics cardinality. */
const SEER_EXPLORER_ANALYTICS_PIXEL_BUCKET = 50;

/**
 * Round a CSS-pixel layout size into coarse buckets for analytics (default 50px).
 * Keeps Amplitude distributions useful without exploding cardinality on exact
 * device widths/heights or drag endpoints.
 */
export function roundSeerExplorerAnalyticsPixels(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return (
    Math.round(Math.max(0, value) / SEER_EXPLORER_ANALYTICS_PIXEL_BUCKET) *
    SEER_EXPLORER_ANALYTICS_PIXEL_BUCKET
  );
}

/** Current browser viewport size, bucketed for Seer Explorer analytics events. */
export function getSeerExplorerAnalyticsBrowserSize(): {
  browser_height: number;
  browser_width: number;
} {
  return {
    browser_width: roundSeerExplorerAnalyticsPixels(window.innerWidth),
    browser_height: roundSeerExplorerAnalyticsPixels(window.innerHeight),
  };
}

type SeerExplorerSidebarOrientation = 'right' | 'bottom';

/**
 * Resolves the dock preference to a concrete orientation. `auto` docks right on
 * wide viewports (≥ `xl`) and on short landscape viewports (e.g. phones in
 * landscape), and bottom otherwise. Shared by the layout (to lay out the split)
 * and the provider (to persist the popped-out window's size to the right key).
 */
export function useSeerExplorerSidebarOrientation(
  sidebarPosition: SeerExplorerSidebarPosition
): SeerExplorerSidebarOrientation {
  const theme = useTheme();
  const isWideScreen = useMedia(`(min-width: ${theme.breakpoints.xl})`);
  const isShortLandscape = useMedia(
    `(orientation: landscape) and (max-height: ${theme.breakpoints.xs})`
  );
  if (sidebarPosition === 'auto') {
    return isWideScreen || isShortLandscape ? 'right' : 'bottom';
  }
  return sidebarPosition;
}

/**
 * Every artifact in the conversation, from whichever channel carried it.
 *
 * A classic artifact tool appends to `block.artifacts`; Code Mode returns them on a tool result's
 * `structuredContent.artifacts`. Neither is converted into the other, so both are walked in run
 * order — blocks in sequence, and within a block its tool results in sequence
 * (codemode-structured-content-only).
 */
export function collectArtifacts(blocks: Block[]): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const block of blocks) {
    artifacts.push(...(block.artifacts ?? []));
    for (const result of block.tool_results ?? []) {
      artifacts.push(...(result?.structuredContent?.artifacts ?? []));
    }
  }
  return artifacts;
}
