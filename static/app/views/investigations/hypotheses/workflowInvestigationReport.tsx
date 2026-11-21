import {Fragment} from 'react';

import {Heading} from '@sentry/scraps/text';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {t} from 'sentry/locale';
import type {WorkflowReport} from 'sentry/views/investigations/types';

import {HypothesisList} from './hypothesisList';

export function WorkflowInvestigationReport({report}: {report: WorkflowReport}) {
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
        <section>
          <Heading as="h3" size="lg">
            {t('Hypotheses')}
          </Heading>
          <HypothesisList hypotheses={report.hypotheses} />
        </section>
      )}
    </Fragment>
  );
}
