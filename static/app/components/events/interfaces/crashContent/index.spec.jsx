import {render} from 'sentry-test/reactTestingLibrary';

import CrashContent from 'sentry/components/events/interfaces/crashContent';
import {withMeta} from 'sentry/components/events/meta/metaProxy';

describe('CrashContent', function () {
  const exc = TestStubs.ExceptionWithMeta({platform: 'cocoa'});
  const event = TestStubs.Event();

  const proxiedExc = withMeta(exc);

  it('renders with meta data', function () {
    const wrapper = render(
      <CrashContent
        projectId="sentry"
        stackView="full"
        stackType="original"
        event={event}
        newestFirst
        exception={proxiedExc.exception}
      />
    );

    expect(wrapper.container).toSnapshot();
  });
});
