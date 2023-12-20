import {Event as EventFixture} from 'sentry-fixture/event';
import {EventEntry as EventEntryFixture} from 'sentry-fixture/eventEntry';
import {EventStacktraceException as EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render} from 'sentry-test/reactTestingLibrary';

import {RouteContext} from 'sentry/views/routeContext';
import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = EventEntryFixture();
  const exception = EventStacktraceExceptionFixture().entries[0];
  const params = {shareId: 'a'};
  const router = TestStubs.router({params});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project: ProjectFixture({organization: Organization({slug: 'test-org'})}),
      }),
    });
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: GroupFixture({
        title: 'ZeroDivisionError',
        latestEvent: EventFixture({
          entries: [eventEntry, exception],
        }),
        project: ProjectFixture({organization: Organization({slug: 'test-org'})}),
      }),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    render(
      <RouteContext.Provider value={{router, ...router}}>
        <SharedGroupDetails
          params={params}
          api={new MockApiClient()}
          route={{}}
          router={router}
          routes={router.routes}
          routeParams={router.params}
          location={router.location}
        />
      </RouteContext.Provider>
    );
  });

  it('renders with org slug in path', function () {
    const params_with_slug = {shareId: 'a', orgId: 'test-org'};
    const router_with_slug = TestStubs.router({params_with_slug});
    render(
      <RouteContext.Provider value={{router, ...router}}>
        <SharedGroupDetails
          params={params}
          api={new MockApiClient()}
          route={{}}
          router={router_with_slug}
          routes={router_with_slug.routes}
          routeParams={router_with_slug.params}
          location={router_with_slug.location}
        />
      </RouteContext.Provider>
    );
  });
});
