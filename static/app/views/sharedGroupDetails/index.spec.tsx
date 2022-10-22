import {Event} from 'fixtures/js-stubs/event.js';
import {EventEntry} from 'fixtures/js-stubs/eventEntry.js';
import {EventStacktraceException} from 'fixtures/js-stubs/eventStacktraceException.js';
import {Group} from 'fixtures/js-stubs/group.js';
import {Project} from 'fixtures/js-stubs/project.js';
import {router} from 'fixtures/js-stubs/router.js';

import {render} from 'sentry-test/reactTestingLibrary';

import {RouteContext} from 'sentry/views/routeContext';
import SharedGroupDetails from 'sentry/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = EventEntry();
  const exception = EventStacktraceException().entries[0];
  const params = {shareId: 'a'};
  const router = router({params});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/shared/issues/a/',
      body: Group({
        title: 'ZeroDivisionError',
        latestEvent: Event({
          entries: [eventEntry, exception],
        }),
        project: Project({organization: {slug: 'test-org'}}),
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
});
