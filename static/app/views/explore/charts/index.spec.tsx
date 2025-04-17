import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {defaultVisualizes} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

describe('ExploreCharts', () => {
  it('renders the progressive loading indicator when the widget is progressively loading', async () => {
    const mockTimeseriesResult = {
      data: {
        'count(span.duration)': [
          {
            data: [{timestamp: '2021-01-01', value: 123.0}],
            field: 'count(span.duration)',
            meta: {type: 'duration', unit: DurationUnit.MILLISECOND},
          },
        ],
      },
      isLoading: true,
      isFetching: false,
    } as any;

    const {rerender} = render(
      <ExploreCharts
        canUsePreviousResults={false}
        confidences={[]}
        query={''}
        timeseriesResult={mockTimeseriesResult}
        visualizes={defaultVisualizes()}
        setVisualizes={() => {}}
      />,
      {
        organization: OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        }),
      }
    );

    expect(
      await screen.findByTestId('progressive-loading-indicator')
    ).toBeInTheDocument();

    rerender(
      <ExploreCharts
        canUsePreviousResults={false}
        confidences={[]}
        query={''}
        timeseriesResult={mockTimeseriesResult}
        visualizes={defaultVisualizes()}
        setVisualizes={() => {}}
        samplingMode={SAMPLING_MODE.BEST_EFFORT}
      />
    );

    expect(screen.queryByTestId('progressive-loading-indicator')).not.toBeInTheDocument();
  });
});
