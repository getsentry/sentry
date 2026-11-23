import {Fragment, type ComponentProps} from 'react';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {t} from 'sentry/locale';
import {HYPOTHESES_ELEMENT_ID} from 'sentry/views/investigations/detail/outline';
import type {WorkflowReport} from 'sentry/views/investigations/types';

import {HypothesisList} from './hypothesisList';
import {HypothesesPanel} from './investigationHypotheses';

export function WorkflowInvestigationReport({
  report,
  getActions,
  onAskSeerAboutHypotheses,
}: {
  report: WorkflowReport;
  getActions?: ComponentProps<typeof HypothesisList>['getActions'];
  onAskSeerAboutHypotheses?: (hypotheses: WorkflowReport['hypotheses']) => void;
}) {
  return (
    <Fragment>
      {(report.summary || report.activity.length > 0) && (
        <details>
          <summary>{t('Broad scan')}</summary>
          {report.summary && <p>{report.summary}</p>}
          {report.activity.map(message => (
            <SeerMarkdown key={message} raw={message} />
          ))}
        </details>
      )}
      {report.hypotheses.length > 0 && (
        <section id={HYPOTHESES_ELEMENT_ID}>
          <HypothesesPanel
            key={report.runId}
            hypotheses={report.hypotheses}
            defaultExpanded={
              report.active && report.hypotheses.some(h => !h.agentVerdict)
            }
            onAskSeer={
              onAskSeerAboutHypotheses &&
              (() => onAskSeerAboutHypotheses(report.hypotheses))
            }
          >
            <HypothesisList
              hypotheses={report.hypotheses}
              getActions={getActions}
              showFindings
            />
          </HypothesesPanel>
        </section>
      )}
    </Fragment>
  );
}
