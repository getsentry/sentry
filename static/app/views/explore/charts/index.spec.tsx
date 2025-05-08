import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {defaultVisualizes} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

describe('ExploreCharts', () => {
  it('renders the high accuracy message when the widget is loading more data', async () => {
    const mockTimeseriesResult = {
      data: {
        'count(span.duration)': [
          {
            values: [{timestamp: '2021-01-01', value: 123.0}],
            field: 'count(span.duration)',
            meta: {type: 'duration', unit: DurationUnit.MILLISECOND},
          },
        ],
      },
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
        dataset={DiscoverDatasets.SPANS_EAP}
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
