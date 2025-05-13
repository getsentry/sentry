import {useMemo} from 'react';

import type {AutofixData} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {
  getRootCauseCopyText,
  getSolutionCopyText,
} from 'sentry/components/events/autofix/utils';
import {
  type GroupSummaryData,
  useGroupSummaryData,
} from 'sentry/components/group/groupSummary';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';

export const issueAndEventToMarkdown = (
  group: Group,
  event: Event | null | undefined,
  groupSummaryData: GroupSummaryData | null | undefined,
  autofixData: AutofixData | null | undefined
): string => {
  // Format the basic issue information
  let markdownText = `# ${group.title}\n\n`;
  markdownText += `**Issue ID:** ${group.id}\n`;

  if (group.project?.slug) {
    markdownText += `**Project:** ${group.project?.slug}\n`;
  }

  if (event && typeof event.dateCreated === 'string') {
    markdownText += `**Date:** ${new Date(event.dateCreated).toLocaleString()}\n`;
  }

  if (groupSummaryData) {
    markdownText += `## Issue Summary\n${groupSummaryData.headline}\n`;
    markdownText += `**What's wrong:** ${groupSummaryData.whatsWrong}\n`;
    if (groupSummaryData.trace) {
      markdownText += `**In the trace:** ${groupSummaryData.trace}\n`;
    }
    if (groupSummaryData.possibleCause && !autofixData) {
      markdownText += `**Possible cause:** ${groupSummaryData.possibleCause}\n`;
    }
  }

  if (autofixData) {
    const rootCauseCopyText = getRootCauseCopyText(autofixData);
    const solutionCopyText = getSolutionCopyText(autofixData);

    if (rootCauseCopyText) {
      markdownText += `\n## Root Cause\n\`\`\`\n${rootCauseCopyText}\n\`\`\`\n`;
    }
    if (solutionCopyText) {
      markdownText += `\n## Solution\n\`\`\`\n${solutionCopyText}\n\`\`\`\n`;
    }
  }

  if (event && Array.isArray(event.tags) && event.tags.length > 0) {
    markdownText += `\n## Tags\n\n`;
    event.tags.forEach(tag => {
      if (tag && typeof tag.key === 'string') {
        markdownText += `- **${tag.key}:** ${tag.value}\n`;
      }
    });
  }

  event?.entries.forEach(entry => {
    if (entry.type === EntryType.EXCEPTION && entry.data.values) {
      markdownText += `\n## Exception${entry.data.values.length > 1 ? 's' : ''}\n\n`;

      entry.data.values.forEach((exception, index, arr) => {
        if (exception.type || exception.value) {
          markdownText += `### Exception ${index + 1}\n`;
          if (exception.type) {
            markdownText += `**Type:** ${exception.type}\n`;
          }
          if (exception.value) {
            markdownText += `**Value:** ${exception.value}\n\n`;
          }

          // Add stacktrace if available
          if (exception.stacktrace?.frames && exception.stacktrace.frames.length > 0) {
            markdownText += `#### Stacktrace\n\n`;
            markdownText += `\`\`\`\n`;

            // Process frames (show at most 16 frames, similar to Python example)
            const maxFrames = 16;
            const frames = exception.stacktrace.frames.slice(-maxFrames);

            // Display frames in reverse order (most recent call first)
            [...frames].reverse().forEach(frame => {
              const function_name = frame.function || 'Unknown function';
              const filename = frame.filename || 'unknown file';
              const lineInfo =
                frame.lineNo === undefined ? 'Line: Unknown' : `Line ${frame.lineNo}`;
              const colInfo = frame.colNo === undefined ? '' : `, column ${frame.colNo}`;
              const inAppInfo = frame.inApp ? 'In app' : 'Not in app';

              markdownText += ` ${function_name} in ${filename} [${lineInfo}${colInfo}] (${inAppInfo})\n`;

              // Add context if available
              frame.context.forEach((ctx: [number, string | null]) => {
                if (Array.isArray(ctx) && ctx.length >= 2) {
                  const isSuspectLine = ctx[0] === frame.lineNo;
                  markdownText += `${ctx[1]}${isSuspectLine ? '  <-- SUSPECT LINE' : ''}\n`;
                }
              });

              // Add variables if available
              if (frame.vars) {
                markdownText += `---\nVariable values at the time of the exception:\n`;
                markdownText += JSON.stringify(frame.vars, null, 2) + '\n';
              }

              if (index < arr.length - 1) {
                markdownText += `------\n`;
              }
            });

            markdownText += `\`\`\`\n`;
          }
        }
      });
    }
  });

  return markdownText;
};

export const useCopyIssueDetails = (group: Group, event?: Event) => {
  const organization = useOrganization();

  // These aren't guarded by useAiConfig because they are both non fetching, and should only return data when it's fetched elsewhere.
  const {data: groupSummaryData} = useGroupSummaryData(group);
  const {data: autofixData} = useAutofixData({groupId: group.id});

  const text = useMemo(() => {
    return issueAndEventToMarkdown(group, event, groupSummaryData, autofixData);
  }, [group, event, groupSummaryData, autofixData]);

  const {onClick} = useCopyToClipboard({
    text,
    successMessage: t('Copied issue to clipboard as Markdown'),
    errorMessage: t('Could not copy issue to clipboard'),
    onCopy: () => {
      trackAnalytics('issue_details.copy_issue_details_as_markdown', {
        organization,
        groupId: group.id,
        eventId: event?.id,
        hasAutofix: Boolean(autofixData),
        hasSummary: Boolean(groupSummaryData),
      });
    },
  });

  useHotkeys([
    {
      match: 'command+alt+c',
      callback: onClick,
      skipPreventDefault: NODE_ENV === 'development',
    },
    {
      match: 'ctrl+alt+c',
      callback: onClick,
      skipPreventDefault: NODE_ENV === 'development',
    },
  ]);
};
