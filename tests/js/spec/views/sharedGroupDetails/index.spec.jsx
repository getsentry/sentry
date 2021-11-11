import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import SharedGroupDetails from 'app/views/sharedGroupDetails';

describe('SharedGroupDetails', function () {
  const eventEntry = TestStubs.EventEntry();
  const exception = TestStubs.EventStacktraceException().entries[0];

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
    const props = {
      params: {shareId: 'a'},
    };

    const {container} = mountWithTheme(<SharedGroupDetails {...props} />);
    expect(container).toSnapshot();
  });
});
