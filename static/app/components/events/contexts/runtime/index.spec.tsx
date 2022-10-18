import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {RuntimeEventContext} from 'sentry/components/events/contexts/runtime';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

export const runtimeMockData = {
  version: '1.7.13',
  type: 'runtime',
  build: '2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0]',
  name: '',
};

export const runtimeMetaMockData = {
  name: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 98,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      runtime: runtimeMetaMockData,
    },
  },
};

describe('runtime event context', function () {
  it('display redacted data', async function () {
    const {organization, router} = initializeOrg();
    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <RuntimeEventContext event={event} data={runtimeMockData} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
