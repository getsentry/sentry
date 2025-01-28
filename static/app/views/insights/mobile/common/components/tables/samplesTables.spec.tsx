import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {SamplesTables} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';

jest.mock('sentry/views/insights/common/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5-alpha.1+42',
  isLoading: false,
  secondaryRelease: 'com.example.vu.android@2.10.3+42',
});

describe('SamplesTables', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.user-geo-subregion-selector',
        }),
      ],
      body: {
        data: [
          {'user.geo.subregion': '21', 'count()': 123},
          {'user.geo.subregion': '155', 'count()': 123},
        ],
        meta: {
          fields: {'user.geo.subregion': 'string', 'count()': 'integer'},
        },
      },
    });
  });

  it('accepts components for event samples and span operation table', async () => {
    render(
      <SamplesTables
        EventSamples={({release}) => (
          <div>{`This is a custom Event Samples table for release: ${release}`}</div>
        )}
        SpanOperationTable={_props => <div>This is a custom Span Operation table</div>}
        transactionName={''}
      />
    );

    // The span operation table is rendered first
    expect(
      await screen.findByText('This is a custom Span Operation table')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'By Event'}));

    expect(
      await screen.findByText(
        'This is a custom Event Samples table for release: com.example.vu.android@2.10.5-alpha.1+42'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This is a custom Event Samples table for release: com.example.vu.android@2.10.3+42'
      )
    ).toBeInTheDocument();
  });
});
