import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconAllProjects} from '@sentry/icons/allProjects';
import {IconClock} from '@sentry/icons/clock';
import {IconFire} from '@sentry/icons/fire';
import {IconSentry} from '@sentry/icons/sentry';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {ProjectList} from 'sentry/components/projectList';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowConfigResponse,
  SeerWorkflowConfigsResponse,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

/**
 * The narrowest a card may get before the grid drops to fewer columns per row.
 */
const MIN_CARD_WIDTH = '280px';

/**
 * "daily" configs are picked up by the seer-night-shift cron, which fires at 10:00
 * and 22:00 UTC (see TASKWORKER_SCHEDULES in src/sentry/conf/server.py).
 */
const DAILY_SCHEDULE_HOURS = [10, 22];

/**
 * How many project avatars/slugs a card shows before collapsing the rest.
 */
const MAX_VISIBLE_PROJECTS = 3;

// TODO: Missing fields from backend - to add to configs API
type AdditionalConfig = {
  /**
   * Estimated cost of a single run, in US dollars
   */
  costPerRun?: number;
  /**
   * Estimated tokens used per month
   */
  tokensPerMonth?: number;
  /**
   * What triggers the automation, shown in place of its schedule
   */
  trigger?: string;
};

// TODO: can just be Response type once API updated
export type AutomationConfig = SeerWorkflowConfigResponse & AdditionalConfig;

function makePlaceholderConfig(
  id: string,
  overrides: Partial<AutomationConfig>
): AutomationConfig {
  return {
    id,
    dateAdded: '',
    dateUpdated: '',
    enabled: true,
    environments: [],
    filters: {},
    outputPolicy: {},
    projects: [ALL_ACCESS_PROJECTS],
    schedule: '',
    seededDefault: null,
    strategy: '',
    version: 0,
    ...overrides,
  };
}

/**
 * Temporary mock data for configs endpoint
 */
export const PLACEHOLDER_CONFIGS: AutomationConfig[] = [
  makePlaceholderConfig('placeholder-agentic-triage', {
    strategy: 'agentic_triage_v2',
    dateLastRun: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    lastRunStatus: 'complete',
    schedule: 'daily',
    tokensPerMonth: 85_400_000,
    costPerRun: 2.5,
  }),
  makePlaceholderConfig('placeholder-breached-metrics', {
    strategy: 'breached_metrics',
    dateLastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastRunStatus: 'complete',
    trigger: 'Triggered by metric exceptions',
    tokensPerMonth: 341_000,
    costPerRun: 0.052,
    projects: [6178942, 11276, 4511418012073984],
  }),
];

export default function AutomationsList() {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  const {data} = useQuery(
    apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        staleTime: 0,
      }
    )
  );

  const configs: AutomationConfig[] = [...PLACEHOLDER_CONFIGS, ...(data?.configs ?? [])];

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return (
    <Grid
      as="ul"
      columns={`repeat(auto-fill, minmax(min(${MIN_CARD_WIDTH}, 100%), 1fr))`}
      gap="lg"
      margin="0"
      padding="0"
    >
      {configs.map(config => (
        <AutomationCard key={config.id} config={config} />
      ))}
    </Grid>
  );
}

function AutomationCard({config}: {config: AutomationConfig}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const strategyMeta = Object.hasOwn(STRATEGY_META, config.strategy)
    ? STRATEGY_META[config.strategy as WorkflowStrategy]
    : undefined;

  const {enabled, trigger, tokensPerMonth, costPerRun} = config;
  const title = strategyMeta?.label ?? config.strategy;
  const description = strategyMeta?.description ?? t('No description');
  const projectSlugs = config.projects.includes(ALL_ACCESS_PROJECTS)
    ? ['all']
    : config.projects
        .map(id => projects.find(p => p.id === String(id))?.slug)
        .filter((slug): slug is string => slug !== undefined);
  const nextUpdate = getNextUpdate(config.schedule);

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
      <CardLink to={getAutomationDetailPath(organization.slug, config.id)}>
        <CardStack
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
            {enabled ? (
              trigger ? (
                <Flex>
                  <Tag variant="muted" icon={<IconFire />}>
                    {trigger}
                  </Tag>
                </Flex>
              ) : (
                nextUpdate && (
                  <Flex>
                    <Tag variant="muted" icon={<IconClock />}>
                      {tct('Next run [time]', {
                        time: (
                          <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />
                        ),
                      })}
                    </Tag>
                  </Flex>
                )
              )
            ) : (
              <Flex>
                <Tag variant="warning">{t('Paused')}</Tag>
              </Flex>
            )}
            {description && <Text as="p">{description}</Text>}
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
          </Stack>
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
              <ProjectList
                projectSlugs={projectSlugs}
                maxVisibleProjects={MAX_VISIBLE_PROJECTS}
                disableLinks
              />
              <Container flex="1" minWidth={0}>
                <Text size="sm" variant="muted" wordBreak="break-word">
                  {projectSlugs.slice(0, MAX_VISIBLE_PROJECTS).join(', ')}
                  {projectSlugs.length > MAX_VISIBLE_PROJECTS && (
                    <Fragment>
                      {' '}
                      <InfoText
                        title={projectSlugs.slice(MAX_VISIBLE_PROJECTS).join(', ')}
                      >
                        {tn(
                          '+%s more',
                          '+%s more',
                          projectSlugs.length - MAX_VISIBLE_PROJECTS
                        )}
                      </InfoText>
                    </Fragment>
                  )}
                </Text>
              </Container>
            </Flex>
          )}
        </CardStack>
      </CardLink>
    </Container>
  );
}

const CardLink = styled(Link)`
  display: grid;
  color: inherit;

  &:hover {
    color: inherit;
  }
`;

const CardStack = styled(Stack)`
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

/**
 * When an automation with this schedule next runs. "daily" is the only supported
 * schedule for now.
 */
export function getNextUpdate(schedule: string): Date | undefined {
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
