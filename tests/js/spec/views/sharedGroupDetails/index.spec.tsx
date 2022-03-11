import {render} from 'sentry-test/reactTestingLibrary';

import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = TestStubs.EventEntry();
  const exception = TestStubs.EventStacktraceException().entries[0];
  const params = {shareId: 'a'};
  const router = TestStubs.router({params});

  beforeEach(function () {
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
      <SharedGroupDetails
        params={params}
        api={new MockApiClient()}
        route={{}}
        router={router}
        routes={router.routes}
        routeParams={router.params}
        location={router.location}
      />
    );

    expect(container).toSnapshot();
  });
});
