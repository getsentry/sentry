import {render} from 'sentry-test/reactTestingLibrary';

import {CrashContent} from 'sentry/components/events/interfaces/crashContent';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

describe('CrashContent', function () {
  const exc = TestStubs.ExceptionWithMeta();
  const proxiedExc = withMeta(exc);

  it('renders with meta data', function () {
    const wrapper = render(
      <CrashContent
        stackView={STACK_VIEW.FULL}
        stackType={STACK_TYPE.ORIGINAL}
        event={TestStubs.Event()}
        newestFirst
        exception={(proxiedExc as any).exception}
        projectSlug={TestStubs.Project().slug}
        hasHierarchicalGrouping={false}
      />
    );

    expect(wrapper.container).toSnapshot();
  });
});
