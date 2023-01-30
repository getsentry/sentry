import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import EventView from 'sentry/utils/discover/eventView';
import {Tags} from 'sentry/views/discover/tags';

describe('Tags', function () {
  function generateUrl(key, value) {
    return `/endpoint/${key}/${value}`;
  }

  const org = TestStubs.Organization();
  beforeEach(function () {
    Client.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      body: [
        {
          key: 'release',
          topValues: [{count: 3, value: '123abcd', name: '123abcd'}],
        },
        {
          key: 'environment',
          topValues: [
            {count: 2, value: 'abcd123', name: 'abcd123'},
            {count: 1, value: 'anotherOne', name: 'anotherOne'},
          ],
        },
        {
          key: 'color',
          topValues: [{count: 3, value: 'red', name: 'red'}],
        },
      ],
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('renders', async function () {
    const api = new Client();

    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
    });

    render(
      <Tags
        eventView={view}
        api={api}
        totalValues={3}
        organization={org}
        selection={{projects: [], environments: [], datetime: {}}}
        location={{query: {}}}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />
    );

    // component is in loading state
    expect(screen.getAllByTestId('loading-placeholder')[0]).toBeInTheDocument();

    // component has loaded
    await waitForElementToBeRemoved(
      () => screen.queryAllByTestId('loading-placeholder')[0]
    );
  });

  it('creates URLs with generateUrl', async function () {
    const api = new Client();

    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
    });

    const initialData = initializeOrg({
      organization: org,
      router: {
        location: {query: {}},
      },
    });

    render(
      <Tags
        eventView={view}
        api={api}
        organization={org}
        totalValues={3}
        selection={{projects: [], environments: [], datetime: {}}}
        location={initialData.router.location}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />,
      {context: initialData.routerContext}
    );

    // component has loaded
    await waitForElementToBeRemoved(
      () => screen.queryAllByTestId('loading-placeholder')[0]
    );
    userEvent.click(screen.getByText('environment'));

    userEvent.click(
      screen.getByRole('link', {
        name: 'environment, abcd123, 66% of all events. View events with this tag value.',
      })
    );

    expect(initialData.router.push).toHaveBeenCalledWith('/endpoint/environment/abcd123');
  });

  it('renders tag keys', async function () {
    const api = new Client();

    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
    });

    render(
      <Tags
        eventView={view}
        api={api}
        totalValues={3}
        organization={org}
        selection={{projects: [], environments: [], datetime: {}}}
        location={{query: {}}}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />
    );

    await waitForElementToBeRemoved(
      () => screen.queryAllByTestId('loading-placeholder')[0]
    );

    expect(screen.getByRole('listitem', {name: 'release'})).toBeInTheDocument();
    expect(screen.getByRole('listitem', {name: 'environment'})).toBeInTheDocument();
    expect(screen.getByRole('listitem', {name: 'color'})).toBeInTheDocument();
  });
});
