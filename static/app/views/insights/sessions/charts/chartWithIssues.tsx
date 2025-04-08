import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/container/flex';
import {Button, LinkButton} from 'sentry/components/core/button';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Panel from 'sentry/components/panels/panel';
import {GroupSummary} from 'sentry/components/stream/group';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {WidgetTitleProps} from 'sentry/views/dashboards/widgets/widget/widgetTitle';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {ModalChartContainer} from 'sentry/views/insights/pages/backend/laravel/styles';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/backend/laravel/widgetVisualizationStates';
import useRecentIssues from 'sentry/views/insights/sessions/queries/useRecentIssues';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

interface Props extends WidgetTitleProps {
  description: string;
  error: Error | null;
  isPending: boolean;
  plottables: Plottable[];
  project: Project;
  series: DiscoverSeries[];
  interactiveTitle?: () => React.ReactNode;
  legendSelection?: LegendSelection | undefined;
}

export default function ChartWithIssues({
  description,
  error,
  interactiveTitle,
  isPending,
  legendSelection,
  plottables,
  project,
  series,
  title,
}: Props) {
  const {recentIssues, isPending: isPendingRecentIssues} = useRecentIssues({
    projectId: project.id,
  });
  const pageFilters = usePageFilters();

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  const hasData = series?.length;
  const isLoading = isPending || isPendingRecentIssues;

  if (isLoading) {
    return (
      <Widget
        height={SESSION_HEALTH_CHART_HEIGHT}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  const Title = interactiveTitle ? (
    interactiveTitle()
  ) : (
    <Widget.WidgetTitle title={title} />
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        legendSelection,
        plottables,
      }}
    />
  );

  const footer = hasData && recentIssues && (
    <FooterIssues>
      {recentIssues.map((group, index) => (
        <GroupWrapper canSelect key={group.id}>
          <EventOrGroupHeader index={index} data={group} source={'session-health'} />
          <EventOrGroupExtraDetails data={group} showLifetime={false} />
        </GroupWrapper>
      ))}
    </FooterIssues>
  );

  return (
    <Widget
      Title={Title}
      height={SESSION_HEALTH_CHART_HEIGHT}
      Visualization={visualization}
      Actions={
        <Widget.WidgetToolbar>
          <Widget.WidgetDescription description={description} />
          <Button
            size="xs"
            aria-label={t('Open Full-Screen View')}
            borderless
            icon={<IconExpand />}
            onClick={() => {
              openInsightChartModal({
                title: (
                  <Flex justify="space-between">
                    {title}
                    {hasData && recentIssues?.length ? (
                      <LinkButton size="xs" to={{pathname: `/issues/`}}>
                        {t('View All')}
                      </LinkButton>
                    ) : null}
                  </Flex>
                ),
                children: (
                  <Fragment>
                    <ModalChartContainer>
                      <TimeSeriesWidgetVisualization
                        releases={releases ?? []}
                        plottables={plottables}
                        legendSelection={legendSelection}
                      />
                    </ModalChartContainer>
                    <ModalFooterWrapper>{footer}</ModalFooterWrapper>
                  </Fragment>
                ),
              });
            }}
          />
          {hasData && recentIssues?.length ? (
            <LinkButton size="xs" to={{pathname: `/issues/`}}>
              {t('View All')}
            </LinkButton>
          ) : null}
        </Widget.WidgetToolbar>
      }
      noFooterPadding
      Footer={footer}
    />
  );
}

const FooterIssues = styled('div')`
  display: flex;
  flex-direction: column;
`;

const GroupWrapper = styled(GroupSummary)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(0.5)} ${space(1.5)} ${space(0.5)};
  margin-inline: ${space(1)};

  &:first-child {
    border-top: none;
  }
`;

const ModalFooterWrapper = styled(Panel)`
  margin-top: 50px;
`;
