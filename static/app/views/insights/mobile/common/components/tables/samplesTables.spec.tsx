import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {SamplesTables} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';

jest.mock('sentry/views/insights/common/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5-alpha.1+42',
  isLoading: false,
});

describe('SamplesTables', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.get-span-operations',
        }),
      ],
      body: {
        data: [{'span.op': 'app.start.cold', 'count()': 1996}],
        meta: {
          fields: {'span.op': 'string', 'count()': 'integer'},
        },
      },
    });

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
        transactionName=""
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
  });

  it('renders single event table when only primary release provided', async () => {
    jest.mocked(useReleaseSelection).mockReturnValue({
      primaryRelease: 'com.example.vu.android@2.10.5-alpha.1+42',
      isLoading: false,
    });

    render(
      <SamplesTables
        EventSamples={({release}) => (
          <div>{`Event table for release: ${release || 'none'}`}</div>
        )}
        SpanOperationTable={_props => <div>Span Operation table</div>}
        transactionName=""
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'By Event'}));

    // Should render single event table, not side-by-side comparison
    expect(
      await screen.findByText(
        'Event table for release: com.example.vu.android@2.10.5-alpha.1+42'
      )
    ).toBeInTheDocument();
  });

  it('renders single event table when no releases provided', async () => {
    jest.mocked(useReleaseSelection).mockReturnValue({
      primaryRelease: undefined,
      isLoading: false,
    });

    render(
      <SamplesTables
        EventSamples={({release}) => (
          <div>{`Event table for release: ${release || 'none'}`}</div>
        )}
        SpanOperationTable={_props => <div>Span Operation table</div>}
        transactionName=""
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'By Event'}));

    // Should render single event table with no release
    expect(await screen.findByText('Event table for release: none')).toBeInTheDocument();
  });
});
