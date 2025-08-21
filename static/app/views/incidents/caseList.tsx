import styled from '@emotion/styled';

import portalImage from 'sentry-images/spot/inc-empty-state.svg';

import {Button} from 'sentry/components/core/button';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {CaseRow} from 'sentry/views/incidents/components/caseRow';
import {TemplateSummary} from 'sentry/views/incidents/components/templateSummary';
import {useIncidentCases} from 'sentry/views/incidents/hooks/useIncidentCases';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function IncidentCaseList({template}: {template: IncidentCaseTemplate}) {
  const organization = useOrganization();
  const {incidentCases} = useIncidentCases({organizationSlug: organization.slug});

  const ongoingCases = incidentCases.filter(
    incidentCase => incidentCase.status !== 'resolved'
  );
  const resolvedCases = incidentCases.filter(
    incidentCase => incidentCase.status === 'resolved'
  );

  return (
    <Grid columns="1fr auto" gap="3xl" align="start">
      <Flex direction="column" gap="2xl">
        {ongoingCases.length === 0 ? null : (
          <Flex direction="column" gap="xl">
            <Heading as="h2" variant="danger">
              {t('Ongoing')}
            </Heading>

            {ongoingCases.map(incidentCase => (
              <CaseRow incidentCase={incidentCase} key={incidentCase.id} />
            ))}
          </Flex>
        )}
        {resolvedCases.length === 0 ? null : (
          <Flex direction="column" gap="xl">
            <Heading as="h2" variant="success">
              {t('Resolved')}
            </Heading>
            {resolvedCases.map(incidentCase => (
              <CaseRow incidentCase={incidentCase} key={incidentCase.id} />
            ))}
          </Flex>
        )}
        {incidentCases.length === 0 ? (
          <Grid
            columns="auto"
            border="primary"
            radius="md"
            padding="sm"
            align="center"
            justify="center"
          >
            <Flex
              direction="column"
              gap="xl"
              justify="center"
              padding="xl 0"
              maxWidth="400px"
            >
              <Heading as="h2">{t('Waiting for something to go wrong...')}</Heading>
              <Text density="comfortable">
                {t(
                  "Nothing yet, but Sentry literally can't sleep, so you're good. We're eagerly waiting for something to explode."
                )}
              </Text>
              <Flex>
                <Button size="sm">{t('View a Sample Incident')}</Button>
              </Flex>
            </Flex>
            <img src={portalImage} alt="Sentry having a cool art department" />
          </Grid>
        ) : null}
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
