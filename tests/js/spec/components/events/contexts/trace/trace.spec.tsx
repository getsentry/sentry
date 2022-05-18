import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import Trace from 'sentry/components/events/contexts/trace/trace';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('Trace', function () {
  const {organization} = initializeOrg();
  const event = TestStubs.Event();
  const data = {
    tags: {
      url: 'https://github.com/getsentry/sentry/',
    },
  };

  it('renders text url as a link', function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <Trace organization={organization} data={data} event={event} />
      </OrganizationContext.Provider>
    );

    expect(screen.getByRole('link', {name: 'Open link'})).toHaveAttribute(
      'href',
      data.tags.url
    );
  });
});
