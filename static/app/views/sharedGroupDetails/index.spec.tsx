import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = EventEntryFixture();
  const exception = EventStacktraceExceptionFixture().entries[0];
  const params = {shareId: 'a'};
  const router = RouterFixture({params});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/test-org/projects/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project: ProjectFixture({organization: OrganizationFixture({slug: 'test-org'})}),
      }),
    });
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project: ProjectFixture({organization: OrganizationFixture({slug: 'test-org'})}),
      }),
    });
    MockApiClient.addMockResponse({
      url: `/projects/test-org/project-slug/events/1/actionable-items/`,
      body: {
        errors: [],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', async function () {
    render(
      <SharedGroupDetails
        params={params}
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
      />,
      {router}
    );
    await screen.findByText('Details');
  });

  it('renders with org slug in path', async function () {
    const params_with_slug = {shareId: 'a', orgId: 'test-org'};
    const router_with_slug = RouterFixture({params_with_slug});
    render(
      <SharedGroupDetails
        params={params}
        route={{}}
        router={router_with_slug}
        routes={router_with_slug.routes}
        routeParams={router_with_slug.params}
        location={router_with_slug.location}
      />,
      {router}
    );
    await screen.findByText('Details');
    await screen.findByTestId('sgh-timestamp');
  });
});
