import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Tags} from 'sentry/views/discover/tags';

// There seem to be no types for this, but it's essentially what is passed to the
// EventView constructor
const commonQueryConditions = {
  additionalConditions: new MutableSearch([]),
  display: '',
  start: '',
  end: '',
  id: '',
  name: '',
  project: [1],
  environment: [],
  topEvents: '',
  yAxis: '',
  createdBy: User(),
  team: [parseInt(Team().id, 10)],
  statsPeriod: '14d',
};

describe('Tags', function () {
  function generateUrl(key, value) {
    return `/endpoint/${key}/${value}`;
  }

  const org = Organization();
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      body: [
        {
          key: 'release',
          topValues: [{count: 30, value: '123abcd', name: '123abcd'}],
        },
        {
          key: 'environment',
          topValues: [
            {count: 20, value: 'abcd123', name: 'abcd123'},
            {count: 10, value: 'anotherOne', name: 'anotherOne'},
          ],
        },
        {
          key: 'color',
          topValues: [
            {count: 10, value: 'red', name: 'red'},
            {count: 5, value: 'blue', name: 'blue'},
            {count: 5, value: 'green', name: 'green'},
            {count: 5, value: 'yellow', name: 'yellow'},
            {count: 5, value: 'orange', name: 'orange'},
          ],
        },
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', async function () {
    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
      ...commonQueryConditions,
    });

    render(
      <Tags
        eventView={view}
        api={new MockApiClient()}
        totalValues={30}
        organization={org}
        location={{...LocationFixture(), query: {}}}
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
    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
      ...commonQueryConditions,
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
        api={new MockApiClient()}
        organization={org}
        totalValues={30}
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
    await userEvent.click(screen.getByText('environment'));

    await userEvent.click(
      screen.getByRole('link', {
        name: 'environment, abcd123, 66% of all events. View events with this tag value.',
      })
    );

    expect(initialData.router.push).toHaveBeenCalledWith('/endpoint/environment/abcd123');
  });

  it('renders tag keys', async function () {
    const view = new EventView({
      fields: [],
      sorts: [],
      query: 'event.type:csp',
      ...commonQueryConditions,
    });

    render(
      <Tags
        eventView={view}
        api={new MockApiClient()}
        totalValues={30}
        organization={org}
        location={{...LocationFixture(), query: {}}}
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

  it('excludes top tag values on current page query', async function () {
    const initialData = initializeOrg({
      organization: org,
      router: {
        location: {pathname: '/organizations/org-slug/discover/homepage/', query: {}},
      },
    });

    const view = new EventView({
      fields: [],
      sorts: [],
      query: '',
      ...commonQueryConditions,
    });

    render(
      <Tags
        eventView={view}
        api={new MockApiClient()}
        totalValues={30}
        organization={org}
        location={initialData.router.location}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />,
      {context: initialData.routerContext}
    );

    await waitForElementToBeRemoved(
      () => screen.queryAllByTestId('loading-placeholder')[0]
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Expand color tag distribution'})
    );
    expect(
      screen.getByRole('link', {
        name: 'Other color tag values, 16% of all events. View other tags.',
      })
    ).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/homepage/?query=%21color%3A%5Bred%2C%20blue%2C%20green%2C%20yellow%5D'
    );
  });

  it('has a Show More button when there are more tags', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      match: [MockApiClient.matchQuery({cursor: undefined})],
      headers: {
        Link:
          '<http://localhost/api/0new /organizations()/org-slug/events-facets/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
          '<http://localhost/api/0new /organizations()/org-slug/events-facets/?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"',
      },
      body: [
        {
          key: 'release',
          topValues: [{count: 30, value: '123abcd', name: '123abcd'}],
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/events-facets/`,
      match: [MockApiClient.matchQuery({cursor: '0:10:0'})],
      body: [],
      headers: {
        Link:
          '<http://localhost/api/0new /organizations()/org-slug/events-facets/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:10:1",' +
          '<http://localhost/api/0new /organizations()/org-slug/events-facets/?cursor=0:20:0>; rel="next"; results="false"; cursor="0:20:0"',
      },
    });

    const view = new EventView({
      fields: [],
      sorts: [],
      query: '',
      ...commonQueryConditions,
    });

    render(
      <Tags
        eventView={view}
        api={new MockApiClient()}
        totalValues={30}
        organization={org}
        location={{...LocationFixture(), query: {}}}
        generateUrl={generateUrl}
        confirmedQuery={false}
      />
    );

    await waitForElementToBeRemoved(
      () => screen.queryAllByTestId('loading-placeholder')[0]
    );

    expect(screen.getByRole('button', {name: 'Show More'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show More'}));
    expect(mockRequest).toHaveBeenCalled();

    // Button should disappear when there are no more tags to load
    expect(screen.queryByRole('button', {name: 'Show More'})).not.toBeInTheDocument();
  });
});
