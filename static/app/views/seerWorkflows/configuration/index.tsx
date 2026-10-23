import {skipToken, useQuery} from '@tanstack/react-query';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerWorkflowConfigsResponse} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationRunsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

/**
 * The narrowest a card may get before the grid drops to fewer columns per row.
 * `auto-fill` keeps empty tracks, so an org with only one or two automations
 * gets cards at the usual width instead of cards stretched across the row.
 */
const MIN_CARD_WIDTH = '280px';

// Placeholder cards until the configs response is wired up
const PLACEHOLDER_CARDS = [
  {
    title: 'Agentic Triage',
    description: 'Automatically triages and fixes the most fixable issues.',
  },
  {
    title: 'Error Count Spike',
    description:
      'Enabled by default for every organization. Detects spikes in total error count and immediately starts an investigation.',
  },
  {
    title: 'Breached Metrics',
    description:
      'Monitors backend metrics and investigates why certain key metrics were breached.',
  },
  {
    title: 'Release Health',
    description:
      'Monitors new commits, catches bad releases, and triages the resulting issues.',
  },
  {
    title: 'Telemetry Audit',
    description:
      'Finds the telemetry behind issues Agentic Triage skipped for insufficient info, and plans the change that lets Seer triage them.',
  },
  {
    title: 'Noisy Issues',
    description:
      'Periodically archives new noisy issues caused by browser extensions or ephemeral issues due to third-party APIs.',
  },
];

function workflowConfigsQueryOptions(organizationSlug: string | null) {
  return apiOptions.as<SeerWorkflowConfigsResponse>()(
    '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
    {
      path: organizationSlug ? {organizationIdOrSlug: organizationSlug} : skipToken,
      staleTime: 30_000,
    }
  );
}

export default function Automations() {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  useQuery(workflowConfigsQueryOptions(automationsEnabled ? organization.slug : null));

  return (
    <Grid
      as="ul"
      columns={`repeat(auto-fill, minmax(min(${MIN_CARD_WIDTH}, 100%), 1fr))`}
      gap="lg"
      margin="0"
      padding="0"
    >
      {PLACEHOLDER_CARDS.map(card => (
        <Container as="li" key={card.title} display="grid">
          <Link to={getAutomationRunsPath(organization.slug)}>
            <Stack
              gap="sm"
              height="100%"
              padding="lg"
              border="primary"
              radius="md"
              background="primary"
            >
              <Heading as="h3" size="md">
                {card.title}
              </Heading>
              <Text as="p">{card.description}</Text>
            </Stack>
          </Link>
        </Container>
      ))}
    </Grid>
  );
}
