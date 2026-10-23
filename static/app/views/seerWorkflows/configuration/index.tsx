import {Fragment} from 'react';
import {IconAllProjects} from '@sentry/icons/allProjects';
import {IconClock} from '@sentry/icons/clock';
import {IconFire} from '@sentry/icons/fire';
import {IconSentry} from '@sentry/icons/sentry';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {ProjectList} from 'sentry/components/projectList';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowConfigsResponse,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

/**
 * The narrowest a card may get before the grid drops to fewer columns per row.
 */
const MIN_CARD_WIDTH = '280px';

/**
 * "daily" configs are picked up by the seer-night-shift cron, which fires at 10:00
 * and 22:00 UTC (see TASKWORKER_SCHEDULES in src/sentry/conf/server.py).
 */
const DAILY_SCHEDULE_HOURS = [10, 22];

type AutomationCardProps = {
  id: string;
  /**
   * ['all'] when the automation covers all projects, [] when it covers none
   */
  projectSlugs: string[];
  title: string;
  /**
   * Estimated cost of a single run, in US dollars
   */
  costPerRun?: number;
  description?: string;
  nextUpdate?: Date;
  /**
   * Shown in place of the "Next run" tag, e.g. for automations triggered by events
   */
  subtitleOverride?: {icon: React.ReactNode; text: string};
  /**
   * Estimated tokens used per month
   */
  tokensPerMonth?: number;
};

export default function AutomationsList() {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();
  const {projects} = useProjects();

  const {data} = useQuery(
    apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        staleTime: 0,
      }
    )
  );

  const cards: AutomationCardProps[] = [
    // Placeholders for automations the configs endpoint doesn't return yet
    {
      id: 'placeholder-agentic-triage',
      title: 'Agentic Triage',
      description: 'Automatically triage and fix the most fixable issues.',
      projectSlugs: ['all'],
      nextUpdate: getNextUpdate('daily'),
      tokensPerMonth: 85_400_000,
      costPerRun: 2.5,
    },
    {
      id: 'placeholder-breached-metrics',
      title: 'Breached Metrics',
      description:
        'Monitors backend metrics and investigates why certain key metrics were breached.',
      projectSlugs: ['seer', 'javascript', 'sentry-evals-framework'],
      subtitleOverride: {icon: <IconFire />, text: 'Triggered by metric exceptions'},
      tokensPerMonth: 341_000,
      costPerRun: 0.052,
    },
    ...(data?.configs ?? []).map(config => {
      const meta = Object.hasOwn(STRATEGY_META, config.strategy)
        ? STRATEGY_META[config.strategy as WorkflowStrategy]
        : undefined;
      return {
        id: config.id,
        title: meta?.label ?? config.strategy,
        description: meta?.description ?? t('No description'),
        projectSlugs: config.projects.includes(ALL_ACCESS_PROJECTS)
          ? ['all']
          : config.projects
              .map(id => projects.find(p => p.id === String(id))?.slug)
              .filter((slug): slug is string => slug !== undefined),
        nextUpdate: getNextUpdate(config.schedule),
      };
    }),
  ];

  return (
    <Grid
      as="ul"
      columns={`repeat(auto-fill, minmax(min(${MIN_CARD_WIDTH}, 100%), 1fr))`}
      gap="lg"
      margin="0"
      padding="0"
    >
      {cards.map(card => (
        <AutomationCard key={card.id} {...card} />
      ))}
    </Grid>
  );
}

function AutomationCard({
  title,
  description,
  projectSlugs,
  nextUpdate,
  subtitleOverride,
  tokensPerMonth,
  costPerRun,
}: AutomationCardProps) {
  const usage = [
    tokensPerMonth === undefined
      ? null
      : tct('[tokens] tokens/month', {
          tokens: formatAbbreviatedNumber(tokensPerMonth, undefined, true),
        }),
    costPerRun === undefined
      ? null
      : tct('[cost]/run', {
          cost: costPerRun.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 3,
          }),
        }),
  ].filter(part => part !== null);

  return (
    <Container as="li" display="grid">
      {/* TODO(aliu): Link to the automation's page once it exists */}
      <Stack
        gap="lg"
        height="100%"
        padding="xl"
        border="primary"
        radius="md"
        background="primary"
      >
        <Stack gap="lg" flex="1">
          <Flex align="center" gap="lg">
            <Heading as="h3" size="md">
              {title}
            </Heading>
            <IconSentry size="xs" variant="muted" />
          </Flex>
          {subtitleOverride ? (
            <Flex>
              <Tag variant="muted" icon={subtitleOverride.icon}>
                {subtitleOverride.text}
              </Tag>
            </Flex>
          ) : (
            nextUpdate && (
              <Flex>
                <Tag variant="muted" icon={<IconClock />}>
                  {tct('Next run [time]', {
                    time: <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />,
                  })}
                </Tag>
              </Flex>
            )
          )}
          {description && <Text as="p">{description}</Text>}
        </Stack>
        <Stack gap="lg">
          {usage.length > 0 && (
            <Text size="sm" variant="muted">
              {usage.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && ' | '}
                  {part}
                </Fragment>
              ))}
            </Text>
          )}
          {projectSlugs[0] === 'all' ? (
            <Flex align="center" gap="sm">
              <IconAllProjects size="sm" variant="muted" />
              <Text size="sm" variant="muted">
                {t('All projects')}
              </Text>
            </Flex>
          ) : projectSlugs.length === 0 ? (
            <Text size="sm" variant="muted">
              {t('No projects')}
            </Text>
          ) : (
            <Flex align="center" gap="sm">
              <ProjectList projectSlugs={projectSlugs} />
              {/* TODO(aliu): Limit the length of this list */}
              <Container flex="1" minWidth={0}>
                <Text size="sm" variant="muted">
                  {projectSlugs.join(', ')}
                </Text>
              </Container>
            </Flex>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

/**
 * When an automation with this schedule next runs. "daily" is the only supported
 * schedule for now.
 */
function getNextUpdate(schedule: string): Date | undefined {
  if (schedule !== 'daily') {
    return undefined;
  }
  const now = new Date();
  for (const hour of DAILY_SCHEDULE_HOURS) {
    const next = new Date(now);
    next.setUTCHours(hour, 0, 0, 0);
    if (next > now) {
      return next;
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(10, 0, 0, 0);
  return tomorrow;
}
