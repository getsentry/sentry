import styled from '@emotion/styled';

import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {CaseRow} from 'sentry/views/incidents/components/caseRow';
import {TemplateSummary} from 'sentry/views/incidents/components/templateSummary';
import {useIncidentCases} from 'sentry/views/incidents/hooks/useIncidentCases';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function IncidentCaseList({template}: {template: IncidentCaseTemplate}) {
  const organization = useOrganization();
  const {incidentCases} = useIncidentCases({organizationSlug: organization.slug});

  return (
    <Grid columns="1fr auto" gap="3xl" align="start">
      <Flex direction="column" gap="2xl">
        <Flex direction="column" gap="xl">
          <Heading as="h2" variant="danger">
            {t('Ongoing')}
          </Heading>
          {incidentCases.map(incidentCase => (
            <CaseRow incidentCase={incidentCase} key={incidentCase.id} />
          ))}
        </Flex>
        <Flex direction="column" gap="xl">
          <Heading as="h2" variant="success">
            {t('Resolved')}
          </Heading>
          {incidentCases.map(incidentCase => (
            <CaseRow incidentCase={incidentCase} key={incidentCase.id} />
          ))}
        </Flex>
      </Flex>
      <SummaryCard>
        <TemplateSummary template={template} />
      </SummaryCard>
    </Grid>
  );
}

const SummaryCard = styled(Flex)`
  padding: ${p => `${p.theme.space.lg} ${p.theme.space.md}`};
  background: ${p => p.theme.background};
  justify-self: end;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 4px ${p => p.theme.tokens.border.primary};
`;
