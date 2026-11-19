import type {ReactNode} from 'react';
import {IconGraph} from '@sentry/icons/graph';

import {LinkButton} from '@sentry/scraps/button';
import {getDuration} from '@sentry/scraps/duration';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {FeedbackItemSection} from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getExploreUrl} from 'sentry/views/explore/utils';

import {AGENT_TAG} from './agentFeedback';
import {
  getToolSpanQuery,
  useAgentFeedbackTagCounts,
  useAgentToolStats,
} from './useAgentToolStats';

/**
 * Puts one report in proportion: is the tool it names failing for everyone,
 * or did one agent trip on an edge case?
 */
export function AgentToolHealthSection({tool}: {tool: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {statsByTool, isPending, isError} = useAgentToolStats({tools: [tool]});
  const {counts: reportCounts} = useAgentFeedbackTagCounts(AGENT_TAG.tool);

  const stats = statsByTool.get(tool);
  const reports = reportCounts.find(({value}) => value === tool)?.count ?? 0;

  const failingCallsUrl = getExploreUrl({
    organization,
    selection,
    query: `${getToolSpanQuery([tool])} span.status:error`,
    field: ['mcp.tool.name', 'user.id', 'span.duration', 'timestamp'],
    sort: '-timestamp',
  });

  return (
    <FeedbackItemSection
      collapsible
      icon={<IconGraph size="xs" />}
      sectionKey="agent-tool-health"
      title={t('Tool Health')}
      actions={
        stats ? (
          <LinkButton size="xs" to={failingCallsUrl}>
            {t('View Failing Calls')}
          </LinkButton>
        ) : null
      }
    >
      {isPending ? (
        <Placeholder height="64px" />
      ) : isError ? (
        <Text variant="muted">{t('Unable to load the stats for this tool.')}</Text>
      ) : stats ? (
        <Stack gap="md">
          <Text variant="muted" size="sm">
            {t('Every call to %s in the selected period, from all agents.', tool)}
          </Text>
          <Grid columns="repeat(auto-fit, minmax(110px, 1fr))" gap="md">
            <Stat label={t('Calls')}>{formatAbbreviatedNumber(stats.calls)}</Stat>
            <Stat label={t('Failure rate')} isBad={stats.failureRate >= 0.05}>
              {formatPercentage(stats.failureRate, 1)}
            </Stat>
            <Stat label={t('Users')}>{formatAbbreviatedNumber(stats.users)}</Stat>
            <Stat label={t('p50')}>
              {getDuration(stats.p50Ms / 1000, {precision: 1, style: 'short'})}
            </Stat>
            <Stat label={t('p95')}>
              {getDuration(stats.p95Ms / 1000, {precision: 1, style: 'short'})}
            </Stat>
            <Stat label={t('Reports')}>{reports}</Stat>
            <Stat label={t('Reports per 100k calls')}>
              {stats.calls ? ((reports / stats.calls) * 100_000).toFixed(1) : '—'}
            </Stat>
          </Grid>
        </Stack>
      ) : (
        <Text variant="muted">
          {t('No calls to a tool named %s were recorded in the selected period.', tool)}
        </Text>
      )}
    </FeedbackItemSection>
  );
}

function Stat({
  children,
  label,
  isBad,
}: {
  children: ReactNode;
  label: string;
  isBad?: boolean;
}) {
  return (
    <Stack gap="xs" padding="md" border="primary" radius="md">
      <Text size="xs" variant="muted" uppercase>
        {label}
      </Text>
      <Text size="lg" bold tabular variant={isBad ? 'danger' : 'primary'}>
        {children}
      </Text>
    </Stack>
  );
}
