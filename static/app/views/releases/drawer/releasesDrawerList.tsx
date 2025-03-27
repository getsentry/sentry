import {Fragment, type ReactElement} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {ReleaseMetaBasic} from 'sentry/types/release';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {
  Bucket,
  ChartRendererProps,
} from 'sentry/views/releases/releaseBubbles/types';

import {ReleaseDrawerTable} from './releasesDrawerTable';

interface ReleasesDrawerListProps {
  /**
   * This is a list of the release buckets used by eCharts to draw the
   * release bubbles. Currently unused, but we can use this to traverse
   * through the release buckets within the drawer
   */
  buckets: Bucket[];
  endTs: number;
  environments: readonly string[];
  /**
   * Callback when a release is selected
   */
  onSelectRelease: (release: string, projectId: string) => void;
  projects: readonly number[];
  /**
   * A list of releases in the current release bucket
   */
  releases: ReleaseMetaBasic[];
  startTs: number;
  /**
   * A renderer function that returns a chart. It is called with the trimmed
   * list of releases and timeSeries. It currently uses the
   * `TimeSeriesWidgetVisualization` components props. It's possible we change
   * it to make the props more generic, e.g. pass start/end timestamps and do
   * the series manipulation when we call the bubble hook.
   */
  chartRenderer?: (rendererProps: ChartRendererProps) => ReactElement;
}

/**
 * Renders the a chart + releases table for use in the Global Drawer.
 * Allows users to view releases of a specific timebucket.
 */
export function ReleasesDrawerList({
  startTs,
  endTs,
  chartRenderer,
  releases,
  onSelectRelease,
  projects,
  environments,
}: ReleasesDrawerListProps) {
  const start = new Date(startTs);
  const end = new Date(endTs);

  return (
    <Fragment>
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
              chartRef: (e: ReactEchartsRef | null) => {
                if (e) {
                  // When chart is mounted, zoom the chart into the relevant
                  // bucket
                  e.getEchartsInstance().dispatchAction({
                    type: 'dataZoom',
                    batch: [
                      {
                        // data value at starting location
                        startValue: startTs,
                        // data value at ending location
                        endValue: endTs,
                      },
                    ],
                  });
                }
              },
              releases,
              start,
              end,
            })}
          />
        </ChartContainer>
      ) : null}
      <ReleaseDrawerTable
        projects={projects}
        environments={environments}
        start={start.toISOString()}
        end={end.toISOString()}
        onSelectRelease={onSelectRelease}
      />
    </Fragment>
  );
}

const ChartContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
