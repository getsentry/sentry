import * as Sentry from '@sentry/react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useHotkeys} from 'sentry/utils/useHotkeys';

const issueAndEventToMarkdown = (group: Group, event: Event): string => {
  // Format the basic issue information
  let markdownText = `# ${group.title}\n\n`;
  markdownText += `**Issue ID:** ${group.id}\n`;

  if (group.project?.slug) {
    markdownText += `**Project:** ${group.project?.slug}\n`;
  }

  if (typeof event.dateCreated === 'string') {
    markdownText += `**Date:** ${new Date(event.dateCreated).toLocaleString()}\n`;
  }

  if (Array.isArray(event.tags) && event.tags.length > 0) {
    markdownText += `\n## Tags\n\n`;
    event.tags.forEach(tag => {
      if (tag && typeof tag.key === 'string') {
        markdownText += `- **${tag.key}:** ${tag.value}\n`;
      }
    });
  }

  event.entries.forEach(entry => {
    if (entry.type === EntryType.EXCEPTION) {
      markdownText += `\n## Exception\n\n`;

      entry.data.values?.forEach((exception, index) => {
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

              markdownText += `------\n`;
            });

            markdownText += `\`\`\`\n`;
          }
        }
      });
    }
  });

  return markdownText;
};

export const useCopyIssueDetails = (group?: Group, event?: Event) => {
  const copyIssueDetails = () => {
    if (!group || !event) {
      addErrorMessage(t('Could not copy issue to clipboard'));
      return;
    }

    const text = issueAndEventToMarkdown(group, event);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        addSuccessMessage(t('Copied issue to clipboard as Markdown'));
      })
      .catch(err => {
        Sentry.captureException(err);
        addErrorMessage(t('Could not copy issue to clipboard'));
      });
  };

  useHotkeys([
    {
      match: 'command+alt+c',
      callback: () => copyIssueDetails(),
    },
    {
      match: 'ctrl+alt+c',
      callback: () => copyIssueDetails(),
    },
  ]);

  return {copyIssueDetails};
};
