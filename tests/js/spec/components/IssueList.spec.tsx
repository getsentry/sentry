import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueList} from 'sentry/components/issueList';

describe('IssueList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders loading state', () => {
    const api = new MockApiClient();
    jest.spyOn(api, 'request').mockImplementation(() => {
      return new Promise(_ => {
        return null;
      });
    });

    mountWithTheme(
      <IssueList
        api={api}
        location={TestStubs.location()}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
      />
    );
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const api = new MockApiClient();
    MockApiClient.addMockResponse({
      url: 'endpoint',
      method: 'GET',
      statusCode: 400,
    });

    mountWithTheme(
      <IssueList
        api={api}
        location={TestStubs.location()}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
      />
    );

    expect(screen.getByTestId('loading-error-message')).toBeInTheDocument();
  });

  it('refetches data on click from error state', async () => {
    const api = new MockApiClient();
    MockApiClient.addMockResponse({
      url: 'endpoint',
      method: 'GET',
      statusCode: 400,
    });

    const spy = jest.spyOn(api, 'request');

    mountWithTheme(
      <IssueList
        api={api}
        location={TestStubs.location()}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
      />
    );

    expect(await screen.findByTestId('loading-error-message')).toBeInTheDocument();

    userEvent.click(screen.getByText('Retry'));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders issue list', async () => {
    const api = new MockApiClient();
    const spy = jest.spyOn(api, 'request');

    MockApiClient.addMockResponse({
      url: 'endpoint',
      method: 'GET',
      statusCode: 200,
      body: [TestStubs.Group({id: '1', culprit: 'Stubbed Issue'})],
    });

    mountWithTheme(
      <IssueList
        api={api}
        query={{limit: '5'}}
        location={TestStubs.location({
          query: {
            cursor: '10',
          },
        })}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
      />
    );

    expect(await screen.findByText(/Stubbed Issue/)).toBeInTheDocument();

    // @ts-ignore
    expect(spy.mock.calls[0][1].query).toEqual({
      cursor: '10',
      limit: '5',
    });
  });

  it('renders custom empty state', () => {
    const api = new MockApiClient();
    const CustomEmptyState = jest.fn().mockImplementation(() => <div>Empty State</div>);

    MockApiClient.addMockResponse({
      url: 'endpoint',
      method: 'GET',
      statusCode: 200,
      body: [],
    });

    mountWithTheme(
      <IssueList
        api={api}
        location={TestStubs.location()}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
        renderEmpty={CustomEmptyState}
      />
    );

    expect(screen.getByText('Empty State')).toBeInTheDocument();
    expect(CustomEmptyState).toHaveBeenCalled();
  });

  it('renders empty state', () => {
    const api = new MockApiClient();
    MockApiClient.addMockResponse({
      url: 'endpoint',
      method: 'GET',
      statusCode: 200,
      body: [],
    });

    mountWithTheme(
      <IssueList
        api={api}
        location={TestStubs.location()}
        endpoint="endpoint"
        params={{}}
        router={TestStubs.router()}
        routes={[]}
      />
    );

    expect(screen.getByText(/Nothing to show here, move along/)).toBeInTheDocument();
  });
});
