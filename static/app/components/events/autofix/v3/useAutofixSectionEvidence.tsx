import {useMemo} from 'react';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  AUTOFIX_EVIDENCE_PROPS_RESOLVER,
  type EvidenceButtonProps,
} from 'sentry/components/events/autofix/v3/autofixEvidence';
import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {ToolCall, ToolLink, ToolResult} from 'sentry/views/seerExplorer/types';

interface Evidence {
  evidenceButtonProps: EvidenceButtonProps;
  toolCall: ToolCall;
  toolLink?: ToolLink;
  toolResult?: ToolResult;
}

interface UseAutofixSectionEvidence {
  section: AutofixSection;
}

export function useAutofixSectionEvidence({section}: UseAutofixSectionEvidence) {
  const organization = useOrganization();
  const {projects} = useProjects();

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

        const resolver = AUTOFIX_EVIDENCE_PROPS_RESOLVER[toolCall.function];
        const evidenceButtonProps =
          resolver?.({organization, projects, toolCall, toolLink}) ?? null;

        if (!defined(evidenceButtonProps)) {
          continue;
        }

        evidence.push({
          evidenceButtonProps,
          toolCall,
          toolLink,
          toolResult,
        });
      }

      return evidence;
    });
  }, [organization, projects, section.blocks]);
}
