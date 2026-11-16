import {Fragment} from 'react';
import styled from '@emotion/styled';
import {IconAllProjects} from '@sentry/icons/allProjects';
import {IconClock} from '@sentry/icons/clock';
import {IconFire} from '@sentry/icons/fire';
import {IconSentry} from '@sentry/icons/sentry';
import {IconSiren} from '@sentry/icons/siren';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {EmptyState} from '@sentry/scraps/emptyState';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {ProjectList} from 'sentry/components/projectList';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct, tn} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {userDisplayName} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUserFromId} from 'sentry/utils/useUserFromId';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowConfigResponse,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';
import {
  getAutomationDetailPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

import {useFetchConfigs} from './hooks/configs';
import {useMonitorsById} from './hooks/useMonitorsById';

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

/**
 * The most bullets the monitor tooltip shows. Lists that reach it show one
 * fewer monitor and end with a "+N more" bullet.
 */
const MAX_TOOLTIP_MONITORS = 6;

// TODO: Missing fields from backend - to add to configs API
type AdditionalConfig = {
  /**
   * What triggers the automation, shown in place of its schedule
   */
  trigger?: string;
};

// TODO: can just be Response type once API updated
export type AutomationConfig = SeerWorkflowConfigResponse & AdditionalConfig;

export default function AutomationsList() {
  const automationsEnabled = useAutomationsEnabled();

  const {data, isPending, isLoadingError, refetch} = useFetchConfigs();

  const configs = data ?? [];
  const {data: monitorsById} = useMonitorsById(
    configs.flatMap(config => config.monitorIds)
  );

  if (!automationsEnabled) {
    return <NotFound />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isLoadingError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (configs.length === 0) {
    return <EmptyState title={t('No automations yet.')} />;
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
        <AutomationCard key={config.id} config={config} monitorsById={monitorsById} />
      ))}
    </Grid>
  );
}

function AutomationCard({
  config,
  monitorsById,
}: {
  config: AutomationConfig;
  monitorsById: Map<string, Detector> | undefined;
}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {data: createdByUser} = useUserFromId({
    id: config.createdBy ? Number(config.createdBy) : undefined,
  });
  const strategyMeta = Object.hasOwn(STRATEGY_META, config.strategy)
    ? STRATEGY_META[config.strategy as WorkflowStrategy]
    : undefined;

  const {enabled} = config;
  const isMetricStrategy = config.strategy === 'breached_metric_investigation';
  const trigger = isMetricStrategy ? t('Triggered by metric monitors') : config.trigger;
  const title = config.name ?? strategyMeta?.label ?? config.strategy;
  const description = strategyMeta?.description ?? t('No description');
  const projectSlugs = config.projects.includes(ALL_ACCESS_PROJECTS)
    ? ['all']
    : config.projects
        .map(id => projects.find(p => p.id === String(id))?.slug)
        .filter((slug): slug is string => slug !== undefined);
  const nextUpdate = getNextUpdate(config.schedule);

  return (
    <Container as="li" display="grid">
      <CardLink to={getAutomationDetailPath(organization.slug, config.id)}>
        <CardStack
          gap="lg"
          height="100%"
          minWidth="0"
          padding="xl"
          border="primary"
          radius="md"
          background="primary"
        >
          <Stack gap="lg" flex="1">
            <Tooltip title={title} showOnlyOnOverflow skipWrapper>
              <Heading as="h3" size="md" ellipsis>
                {title}
              </Heading>
            </Tooltip>
            <Flex align="center" gap="sm">
              {enabled ? (
                trigger ? (
                  <Tag variant="muted" icon={<IconFire />}>
                    {trigger}
                  </Tag>
                ) : (
                  nextUpdate && (
                    <Tag variant="muted" icon={<IconClock />}>
                      {tct('Next run [time]', {
                        time: (
                          <TimeSince date={nextUpdate} tooltipPrefix={t('Next run')} />
                        ),
                      })}
                    </Tag>
                  )
                )
              ) : (
                <Tag variant="warning">{t('Paused')}</Tag>
              )}
              {config.createdBy ? (
                createdByUser && (
                  <UserAvatar
                    user={createdByUser}
                    size={16}
                    hasTooltip
                    tooltip={t('Created by %s', userDisplayName(createdByUser))}
                  />
                )
              ) : (
                <Tooltip title={t('Built and maintained by Sentry')}>
                  <IconSentry size="xs" variant="muted" />
                </Tooltip>
              )}
            </Flex>
            {description && <Text as="p">{description}</Text>}
          </Stack>
          {/* TODO: Replace mock values with real usage totals */}
          <Text size="sm" variant="muted">
            {t('Total cost: $(mock) | (mock)m tokens')}
          </Text>
          {isMetricStrategy ? (
            <Tooltip
              disabled={!monitorsById || config.monitorIds.length === 0}
              title={
                <Text as="div" align="left">
                  <Stack gap="xs" align="start">
                    {(config.monitorIds.length >= MAX_TOOLTIP_MONITORS
                      ? config.monitorIds.slice(0, MAX_TOOLTIP_MONITORS - 1)
                      : config.monitorIds
                    ).map(monitorId => {
                      const id = String(monitorId);
                      return (
                        <Container key={id}>
                          <MonitorLink
                            to={makeMonitorDetailsPathname(organization.slug, id)}
                            onClick={event => event.stopPropagation()}
                          >
                            {monitorsById?.get(id)?.name ?? id}
                          </MonitorLink>
                        </Container>
                      );
                    })}
                    {config.monitorIds.length >= MAX_TOOLTIP_MONITORS && (
                      <Container>
                        {tn(
                          '+%s more',
                          '+%s more',
                          config.monitorIds.length - (MAX_TOOLTIP_MONITORS - 1)
                        )}
                      </Container>
                    )}
                  </Stack>
                </Text>
              }
            >
              <Flex align="center" gap="sm">
                <IconSiren size="sm" variant="muted" />
                <Text size="sm" variant="muted">
                  {config.monitorIds.length === 0
                    ? t('No monitors')
                    : tn('%s monitor', '%s monitors', config.monitorIds.length)}
                </Text>
              </Flex>
            </Tooltip>
          ) : projectSlugs[0] === 'all' ? (
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

const MonitorLink = styled(Link)`
  &:hover {
    text-decoration: underline;
  }
`;

const CardLink = styled(Link)`
  display: grid;
  min-width: 0;
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
