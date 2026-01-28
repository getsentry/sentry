import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Stack} from 'sentry/components/core/layout';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Panel from 'sentry/components/panels/panel';
import {GroupSummary} from 'sentry/components/stream/group';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {WidgetTitleProps} from 'sentry/views/dashboards/widgets/widget/widgetTitle';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/types';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/shared/styles';
import useProjectHasSessions from 'sentry/views/insights/sessions/queries/useProjectHasSessions';
import useRecentIssues from 'sentry/views/insights/sessions/queries/useRecentIssues';
import {SESSION_HEALTH_CHART_HEIGHT} from 'sentry/views/insights/sessions/utils/sessions';

interface Props extends WidgetTitleProps, Partial<LoadableChartWidgetProps> {
  description: string;
  error: Error | null;
  isPending: boolean;
  plottables: Plottable[];
  series: DiscoverSeries[];
  hideReleaseLines?: boolean;
  interactiveTitle?: () => React.ReactNode;
  legendSelection?: LegendSelection | undefined;
}

export default function ChartWithIssues(props: Props) {
  const {
    description,
    error,
    hideReleaseLines,
    interactiveTitle,
    isPending,
    legendSelection,
    plottables,
    series,
    title,
    id,
  } = props;
  const {projects} = useProjectHasSessions();
  const {recentIssues, isPending: isPendingRecentIssues} = useRecentIssues({
    projectId: projects[0]?.id,
  });
  const pageFilters = usePageFilters();

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection, {
    enabled: !hideReleaseLines,
  });
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
        ...props,
        id,
        legendSelection,
        plottables,
      }}
    />
  );

  const footer = hasData && recentIssues && (
    <Stack>
      {recentIssues.map(group => (
        <GroupWrapper canSelect key={group.id}>
          <EventOrGroupHeader data={group} source="session-health" />
          <EventOrGroupExtraDetails data={group} showLifetime={false} />
        </GroupWrapper>
      ))}
    </Stack>
  );

  return (
    <Widget
      {...props}
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
                  <Flex justify="between">
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
                        {...props}
                        id={id}
                        showReleaseAs={hideReleaseLines ? 'none' : 'line'}
                        releases={releases}
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

const GroupWrapper = styled(GroupSummary)`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(1)} ${space(0.5)} ${space(1.5)} ${space(0.5)};
  margin-inline: ${space(1)};

  &:first-child {
    border-top: none;
  }
`;

const ModalFooterWrapper = styled(Panel)`
  margin-top: 50px;
`;
