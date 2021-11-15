import {mountWithTheme} from 'sentry-test/enzyme';

import CrashContent from 'app/components/events/interfaces/crashContent';
import {withMeta} from 'app/components/events/meta/metaProxy';
import {OrganizationContext} from 'app/views/organizationContext';

describe('CrashContent', function () {
  const exc = TestStubs.ExceptionWithMeta({platform: 'cocoa'});
  const event = TestStubs.Event();
  const organization = TestStubs.Organization();

  const proxiedExc = withMeta(exc);

  it('renders with meta data', function () {
    const wrapper = mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <CrashContent
          projectId="sentry"
          stackView="full"
          stackType="original"
          event={event}
          newestFirst
          exception={proxiedExc.exception}
        />
      </OrganizationContext.Provider>
    );

    expect(wrapper).toSnapshot();
  });
});
