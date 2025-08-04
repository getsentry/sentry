import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {defaultVisualizes} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';

describe('ExploreCharts', () => {
  it('renders the high accuracy message when the widget is loading more data', async () => {
    const mockTimeseriesResult = {
      data: {},
      isLoading: true,
      isPending: true,
      isFetching: true,
    } as any;

    render(
      <ExploreCharts
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
