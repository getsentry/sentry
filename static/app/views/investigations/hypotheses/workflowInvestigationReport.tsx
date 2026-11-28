import type {ComponentProps} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {HYPOTHESES_ELEMENT_ID} from 'sentry/views/investigations/detail/outline';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';
import type {WorkflowReport} from 'sentry/views/investigations/types';

import {HypothesisList, HypothesisListPlaceholder} from './hypothesisList';
import {HypothesesPanel} from './investigationHypotheses';
import {WorkflowControls} from './workflowControls';

export function WorkflowInvestigationReport({
  notebookId,
  report,
  statusBlock,
  getActions,
  onAskSeerAboutHypotheses,
}: {
  notebookId: string;
  report: WorkflowReport;
  statusBlock: ComponentProps<typeof SeerStatusBlock>;
  getActions?: ComponentProps<typeof HypothesisList>['getActions'];
  onAskSeerAboutHypotheses?: (hypotheses: WorkflowReport['hypotheses']) => void;
}) {
  return (
    <Stack gap="3xl">
      {statusBlock.variant !== 'complete' && <SeerStatusBlock {...statusBlock} />}
      {report.canCommand && <WorkflowControls report={report} notebookId={notebookId} />}
      {(report.hypotheses.length > 0 || report.awaitingHypotheses) && (
        <section id={HYPOTHESES_ELEMENT_ID}>
          <HypothesesPanel
            key={report.runId}
            hypotheses={report.hypotheses}
            defaultExpanded={
              report.status !== 'succeeded' &&
              !['reporting', 'metadata'].includes(report.phase ?? '') &&
              (report.active ||
                report.status === 'failed' ||
                report.status === 'cancelled')
            }
            onAskSeer={
              report.hypotheses.length > 0 && onAskSeerAboutHypotheses
                ? () => onAskSeerAboutHypotheses(report.hypotheses)
                : undefined
            }
          >
            {report.hypotheses.length ? (
              <HypothesisList
                hypotheses={report.hypotheses}
                getActions={getActions}
                primaryHypothesisId={report.primaryHypothesisId ?? undefined}
                showFindings
              />
            ) : (
              <HypothesisListPlaceholder />
            )}
          </HypothesesPanel>
        </section>
      )}
    </Stack>
  );
}
