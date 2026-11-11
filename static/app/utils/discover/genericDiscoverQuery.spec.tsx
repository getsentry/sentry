import omit from 'lodash/omit';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {EventView} from 'sentry/utils/discover/eventView';

import {
  doDiscoverQuery,
  GenericDiscoverQuery,
  type DiscoverQueryProps,
} from './genericDiscoverQuery';

describe('doDiscoverQuery', () => {
  const api = new MockApiClient();
  let eventsMock: any;
  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      status: 429,
      statusCode: 429,
    });
  });

  it('does not retry discover query by default', async () => {
    await expect(
      doDiscoverQuery(api, '/organizations/org-slug/events/', {})
    ).rejects.toBeDefined();
    expect(eventsMock).toHaveBeenCalledTimes(1);
  });
});

describe('GenericDiscoverQuery', () => {
  const location = LocationFixture({pathname: '/events', query: {}});

  function makeEventView(fields: string[], query?: string) {
    return EventView.fromSavedQuery({
      id: '',
      name: 'test query',
      version: 2,
      fields,
      projects: [1],
      query,
    });
  }

  function getPayloadWithoutFields({
    eventView,
    location: payloadLocation,
  }: Pick<DiscoverQueryProps, 'eventView' | 'location'>) {
    return omit(eventView.getEventsAPIPayload(payloadLocation), ['field']);
  }

  function renderQuery(props: {
    eventView: EventView;
    getRequestPayload?: typeof getPayloadWithoutFields;
    version?: number;
  }) {
    return (
      <GenericDiscoverQuery<{data: Array<{transaction: string}>}, {version?: number}>
        route="events"
        orgSlug="test-org"
        location={location}
        shouldRefetchData={(prevProps, nextProps) =>
          prevProps.version !== nextProps.version
        }
        {...props}
      >
        {({tableData, isLoading}) =>
          isLoading ? 'loading' : <p>{tableData?.data[0]?.transaction}</p>
        }
      </GenericDiscoverQuery>
    );
  }

  it('fetches once the event view becomes valid when it starts invalid', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [{transaction: '/health'}]},
    });

    const {rerender} = render(
      renderQuery({
        eventView: makeEventView([]),
        getRequestPayload: getPayloadWithoutFields,
      })
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
    rerender(
      renderQuery({
        eventView: makeEventView(['transaction']),
        getRequestPayload: getPayloadWithoutFields,
      })
    );

    expect(await screen.findByText('/health')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('refetches an equivalent payload when shouldRefetchData reports a change', async () => {
    const getMock = MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [{transaction: '/health'}]},
    });
    const eventView = makeEventView(['transaction']);

    const {rerender} = render(renderQuery({eventView, version: 1}));
    expect(await screen.findByText('/health')).toBeInTheDocument();
    rerender(renderQuery({eventView, version: 2}));

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });

  it('renders the latest response when an earlier request resolves after it', async () => {
    const slowResponse = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [{transaction: '/slow'}]},
      match: [MockApiClient.matchQuery({query: 'transaction:/slow'})],
      asyncDelay: slowResponse.promise,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/events/',
      body: {data: [{transaction: '/fast'}]},
      match: [MockApiClient.matchQuery({query: 'transaction:/fast'})],
    });

    const {rerender} = render(
      renderQuery({eventView: makeEventView(['transaction'], 'transaction:/slow')})
    );
    rerender(
      renderQuery({eventView: makeEventView(['transaction'], 'transaction:/fast')})
    );
    expect(await screen.findByText('/fast')).toBeInTheDocument();
    await act(async () => {
      slowResponse.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(screen.getByText('/fast')).toBeInTheDocument();
    expect(screen.queryByText('/slow')).not.toBeInTheDocument();
  });
});
