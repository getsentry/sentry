import {useMemo} from 'react';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defined} from 'sentry/utils';
import type {ToolCall, ToolLink, ToolResult} from 'sentry/views/seerExplorer/types';

interface Evidence {
  toolCall: ToolCall;
  toolLink?: ToolLink;
  toolResult?: ToolResult;
}

interface UseAutofixSectionEvidence {
  section: AutofixSection;
}

export function useAutofixSectionEvidence({section}: UseAutofixSectionEvidence) {
  return useMemo(() => {
    return section.blocks.flatMap(block => {
      const evidence: Evidence[] = [];

      for (const toolCall of block.message.tool_calls ?? []) {
        const index = block.tool_results?.findIndex(
          toolResult => toolResult?.tool_call_id === toolCall.id
        );
        if (!defined(index)) {
          continue;
        }
        const toolLink = block.tool_links?.[index] ?? undefined;
        const toolResult = block.tool_results?.[index] ?? undefined;
        evidence.push({
          toolCall,
          toolLink,
          toolResult,
        });
      }

      return evidence;
    });
  }, [section.blocks]);
}
