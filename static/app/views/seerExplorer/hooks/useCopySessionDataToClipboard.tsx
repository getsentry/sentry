import {useCallback, useState} from 'react';
import type {LocationDescriptor} from 'history';
import queryString from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getValidToolLinks,
  resolveLink,
  subjectFromToolLink,
} from 'sentry/views/seerExplorer/links';
import type {Block, ToolCall} from 'sentry/views/seerExplorer/types';

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
