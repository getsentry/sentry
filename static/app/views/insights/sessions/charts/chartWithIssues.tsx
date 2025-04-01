import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
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
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {ModalChartContainer} from 'sentry/views/insights/pages/backend/laravel/styles';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/backend/laravel/widgetVisualizationStates';
import useRecentIssues from 'sentry/views/insights/sessions/queries/useRecentIssues';

export default function ChartWithIssues({
  project,
  series,
  plottables,
  title,
  description,
  isPending,
  error,
  legendSelection,
}: {
  description: string;
  error: Error | null;
  isPending: boolean;
  plottables: Plottable[];
  project: Project;
  series: DiscoverSeries[];
  title: string;
  legendSelection?: LegendSelection | undefined;
}) {
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
        height={400}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

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
        <GroupWrapper key={group.id}>
          <GroupSummary canSelect hasNewLayout>
            <EventOrGroupHeader index={index} data={group} source={'session-health'} />
            <EventOrGroupExtraDetails data={group} showLifetime={false} />
          </GroupSummary>
        </GroupWrapper>
      ))}
    </FooterIssues>
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      height={400}
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
                title,
                children: (
                  <Fragment>
                    <ModalChartContainer>
                      <TimeSeriesWidgetVisualization
                        releases={releases ?? []}
                        plottables={plottables}
                        legendSelection={legendSelection}
                      />
                    </ModalChartContainer>
                    <FooterWrapper>{footer}</FooterWrapper>
                  </Fragment>
                ),
              });
            }}
          />
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

const GroupWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(0.5)} ${space(1.5)} ${space(0.5)};

  &:first-child {
    border-top: none;
  }
`;

const FooterWrapper = styled(Panel)`
  margin-top: 50px;
`;
