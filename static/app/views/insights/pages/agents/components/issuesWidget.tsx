import {useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {ExternalLink, Link} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export function IssuesWidget() {
  const pageFilters = usePageFilters().selection;
  const organization = useOrganization();

  const fullQuery = useCombinedQuery('');

  const queryParams = useMemo(
    () => ({
      limit: '5',
      ...normalizeDateTimeParams(pageFilters.datetime),
      project: pageFilters.projects,
      environment: pageFilters.environments,
      query: `is:unresolved event.type:error ${fullQuery}`,
      sort: 'freq',
    }),
    [pageFilters.datetime, pageFilters.environments, pageFilters.projects, fullQuery]
  );

  const {
    data: groups,
    isPending,
    error,
  } = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: queryParams,
      },
    ],
    {staleTime: 0}
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={t('Issues')} />}
      Visualization={
        <WidgetVisualizationStates
          isEmpty={!groups || groups.length === 0}
          isLoading={isPending}
          error={error}
          VisualizationType={IssuesVisualization}
          visualizationProps={{groups: groups ?? []}}
          emptyMessage={
            <GenericWidgetEmptyStateWarning
              message={tct(
                'No issues match your search. If this is unexpected, try updating your filters or learn more about AI Agents Insights in our [link:documentation].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/insights/agents/" />
                  ),
                }
              )}
            />
          }
        />
      }
      noVisualizationPadding
    />
  );
}

function IssuesVisualization({groups}: {groups: Group[]}) {
  return (
    <IssueList>
      {groups.map((issue, index) => (
        <IssueRow key={issue.id} isFirst={index === 0}>
          <PlatformIcon platform={issue.project.platform ?? ''} size={16} />
          <IssueTitle>
            <Link to={`/issues/${issue.id}`}>{issue.title}</Link>
          </IssueTitle>
          <IssueCount value={issue.count} />
        </IssueRow>
      ))}
    </IssueList>
  );
}

IssuesVisualization.LoadingPlaceholder = TimeSeriesWidgetVisualization.LoadingPlaceholder;

const IssueList = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const IssueRow = styled('div')<{isFirst: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  border-top: ${p => (p.isFirst ? 'none' : `1px solid ${p.theme.border}`)};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} ${p => p.theme.space.md}
    ${p => p.theme.space.lg};
`;

const IssueTitle = styled('div')`
  flex: 1;
  font-size: ${p => p.theme.fontSize.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const IssueCount = styled(Count)`
  font-size: ${p => p.theme.fontSize.sm};
`;
