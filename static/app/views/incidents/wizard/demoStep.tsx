import pageImage from 'sentry-images/spot/waiting-for-page.svg';

import {Grid} from 'sentry/components/core/layout';
import {TemplateSummary} from 'sentry/views/incidents/components/templateSummary';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';
import {useIncidentSetupContext} from 'sentry/views/incidents/wizard/context';

export function DemoStep() {
  const {tools, template} = useIncidentSetupContext();

  const {complete: toolsComplete, ...toolsPayload} = tools;
  const {complete: templateComplete, ...templatePayload} = template;

  const payload = {
    ...(toolsComplete ? toolsPayload : {}),
    ...(templateComplete ? templatePayload : {}),
    name: 'Demo Template',
  } as Partial<IncidentCaseTemplate>;

  return (
    <Grid columns="1fr 1fr" gap="3xl" align="center">
      <TemplateSummary template={payload as IncidentCaseTemplate} allowCreate />
      <img
        src={pageImage}
        alt="Sentaur ready for on-call"
        style={{
          transform: 'scaleX(-1) scale(2)',
          opacity: 0.2,
        }}
      />
    </Grid>
  );
}
