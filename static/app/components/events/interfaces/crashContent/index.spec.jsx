import {Event} from 'fixtures/js-stubs/event';
import {ExceptionWithMeta} from 'fixtures/js-stubs/exceptionWithMeta';
import {Organization} from 'fixtures/js-stubs/organization';

import {render} from 'sentry-test/reactTestingLibrary';

import CrashContent from 'sentry/components/events/interfaces/crashContent';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('CrashContent', function () {
  const exc = ExceptionWithMeta({platform: 'cocoa'});
  const event = Event();
  const organization = Organization();

  const proxiedExc = withMeta(exc);

  it('renders with meta data', function () {
    const wrapper = render(
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

    expect(wrapper.container).toSnapshot();
  });
});
