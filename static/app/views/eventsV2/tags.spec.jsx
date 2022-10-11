import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import EventView from 'sentry/utils/discover/eventView';
import {Tags} from 'sentry/views/eventsV2/tags';

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
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'color',
          topValues: [{count: 2, value: 'red', name: 'red'}],
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
        totalValues={2}
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
        totalValues={2}
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

    userEvent.click(
      screen.getByLabelText('Add the environment abcd123 segment tag to the search query')
    );

    expect(initialData.router.push).toHaveBeenCalledWith('/endpoint/environment/abcd123');
  });
});
