import {Fragment, type ReactElement} from 'react';
import styled from '@emotion/styled';

import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';
import type {TimeSeriesWidgetVisualizationProps} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

import {DateTime} from '../dateTime';

import {ReleaseDrawerTable} from './releasesDrawerTable';

type Bucket = [
  start: number,
  placeholder: number,
  end: number,
  releases: number,
  releases: Release[],
];

interface ReleasesDrawerProps {
  /**
   * This is a list of the release buckets used by eCharts to draw the release bubbles.
   * Currently unused, but we can use this to traverse through the release buckets within the drawer
   */
  buckets: Bucket[];
  endTs: number;
  /**
   * A list of releases in the current release bucket
   */
  releases: Release[];
  startTs: number;
  timeSeries: TimeSeriesWidgetVisualizationProps['timeSeries'];
  /**
   * A renderer function that returns a chart. It is called with the trimmed
   * list of releases and timeSeries. It currently uses the
   * `TimeSeriesWidgetVisualization` components props. It's possible we change
   * it to make the props more generic, e.g. pass start/end timestamps and do
   * the series manipulation when we call the bubble hook.
   */
  chartRenderer?: (
    rendererProps: Partial<TimeSeriesWidgetVisualizationProps>
  ) => ReactElement;
}

export function ReleasesDrawer({
  startTs,
  endTs,
  chartRenderer,
  releases,
  timeSeries,
}: ReleasesDrawerProps) {
  const start = new Date(startTs);
  const end = new Date(endTs);
  const trimmedTimeSeries = timeSeries.map(s => ({
    ...s,
    data: s.data.filter(dataItem => {
      const ts = new Date(dataItem.timestamp).getTime();
      return ts >= startTs && ts <= endTs;
    }),
  }));

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={[{label: t('Releases')}]} />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{tn('%s Release', '%s Releases', releases.length)}</Header>
      </EventNavigator>
      <EventDrawerBody>
        {chartRenderer ? (
          <ChartContainer>
            <Widget
              Title={
                <Fragment>
                  {t('Releases from ')}
                  <DateTime date={start} /> <span>{t('to')}</span> <DateTime date={end} />
                </Fragment>
              }
              Visualization={chartRenderer?.({
                releases,
                timeSeries: trimmedTimeSeries,
              })}
            />
          </ChartContainer>
        ) : null}
        <ReleaseDrawerTable start={start.toISOString()} end={end.toISOString()} />
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const ChartContainer = styled('div')`
  height: 220px;
  margin-bottom: ${space(2)};
`;
