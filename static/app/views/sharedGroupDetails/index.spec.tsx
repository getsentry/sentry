import {render} from 'sentry-test/reactTestingLibrary';

import {RouteContext} from 'sentry/views/routeContext';
import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = TestStubs.EventEntry();
  const exception = TestStubs.EventStacktraceException().entries[0];
  const params = {shareId: 'a'};
  const router = TestStubs.router({params});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/shared/issues/a/',
      body: TestStubs.Group({
        title: 'ZeroDivisionError',
        latestEvent: TestStubs.Event({
          entries: [eventEntry, exception],
        }),
        project: TestStubs.Project({organization: {slug: 'test-org'}}),
      }),
    });
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: TestStubs.Group({
        title: 'ZeroDivisionError',
        latestEvent: TestStubs.Event({
          entries: [eventEntry, exception],
        }),
        project: TestStubs.Project({organization: {slug: 'test-org'}}),
      }),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const {container} = render(
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

    expect(container).toSnapshot();
  });

  it('renders with org slug in path', function () {
    const params_with_slug = {shareId: 'a', orgId: 'test-org'};
    const router_with_slug = TestStubs.router({params_with_slug});
    const {container} = render(
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

    expect(container).toSnapshot();
  });
});
