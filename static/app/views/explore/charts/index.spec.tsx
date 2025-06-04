import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {defaultVisualizes} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

describe('ExploreCharts', () => {
  it('renders the high accuracy message when the widget is loading more data', async () => {
    const data: Record<string, TimeSeries[]> = {
      'count(span.duration)': [
        {
          values: [{timestamp: 1729796400000, value: 123.0}],
          yAxis: 'count(span.duration)',
          meta: {valueType: 'duration', valueUnit: DurationUnit.MILLISECOND, interval: 0},
        },
      ],
    };

    const mockTimeseriesResult = {
      data,
      isLoading: true,
      isPending: true,
      isFetching: true,
    } as any;

    render(
      <ExploreCharts
        canUsePreviousResults={false}
        confidences={[]}
        query={''}
        timeseriesResult={mockTimeseriesResult}
        visualizes={defaultVisualizes()}
        setVisualizes={() => {}}
        samplingMode={SAMPLING_MODE.HIGH_ACCURACY}
      />,
      {
        organization: OrganizationFixture(),
      }
    );

    expect(
      await screen.findByText(
        "Hey, we're scanning all the data we can to answer your query, so please wait a bit longer"
      )
    ).toBeInTheDocument();
  });
});
