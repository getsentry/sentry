import styled from '@emotion/styled';

import {Grid} from 'sentry/components/core/layout';
import useOrganization from 'sentry/utils/useOrganization';
import {TemplateSummary} from 'sentry/views/incidents/components/templateSummary';
import {useIncidentCases} from 'sentry/views/incidents/hooks/useIncidentCases';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function IncidentCaseList({template}: {template: IncidentCaseTemplate}) {
  const organization = useOrganization();
  const {incidentCases} = useIncidentCases({organizationSlug: organization.slug});

  return (
    <Grid columns="1fr 1fr" gap="3xl" align="center">
      <ul>
        <li />
      </ul>
      <SummaryCard>
        <TemplateSummary template={template} />
      </SummaryCard>
    </Grid>
  );
}

const SummaryCard = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => `${p.theme.space.lg} ${p.theme.space['2xl']}`};
  display: flex;
  justify-content: space-between;
  background-color: ${p => p.theme.tokens.background.primary};
`;
