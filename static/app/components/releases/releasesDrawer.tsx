import {Fragment, type ReactElement} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import {ReleaseDrawerTable} from 'sentry/components/releases/releasesDrawerTable';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';
import type {Bucket} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

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
  /**
   * A renderer function that returns a chart. It is called with the trimmed
   * list of releases and timeSeries. It currently uses the
   * `TimeSeriesWidgetVisualization` components props. It's possible we change
   * it to make the props more generic, e.g. pass start/end timestamps and do
   * the series manipulation when we call the bubble hook.
   */
  chartRenderer?: (rendererProps: {
    end: Date;
    releases: Release[];
    start: Date;
  }) => ReactElement;
}

export function ReleasesDrawer({
  startTs,
  endTs,
  chartRenderer,
  releases,
}: ReleasesDrawerProps) {
  const start = new Date(startTs);
  const end = new Date(endTs);

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
                start,
                end,
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
