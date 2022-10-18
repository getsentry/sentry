import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {BrowserEventContext} from 'sentry/components/events/contexts/browser';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

export const browserMockData = {
  version: '83.0.4103',
  type: 'browser',
  name: '',
};

export const browserMetaMockData = {
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
      len: 7,
      rem: [['organization:0', 'x', 0, 0]],
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      browser: browserMetaMockData,
    },
  },
};

describe('browser event context', function () {
  it('display redacted data', async function () {
    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

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
          <BrowserEventContext event={event} data={browserMockData} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
