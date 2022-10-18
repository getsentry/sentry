import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GPUEventContext} from 'sentry/components/events/contexts/gpu';
import {GPUData} from 'sentry/components/events/contexts/gpu/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

export const gpuMockData: GPUData = {
  name: '',
  id: 0,
  vendor_id: 0,
  vendor_name: 'Apple',
  memory_size: 4096,
  api_type: '',
  multi_threaded_rendering: true,
  version: 'Metal',
  npot_support: 'Full',
};

export const gpuMetaMockData = {
  api_type: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
  name: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 18,
    },
  },
};

const event = {
  ...TestStubs.Event(),
  _meta: {
    contexts: {
      gpu: gpuMetaMockData,
    },
  },
};

describe('gpu event context', function () {
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
          <GPUEventContext event={event} data={gpuMockData} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(screen.getByText('API Type')).toBeInTheDocument(); // subject
    userEvent.hover(screen.getAllByText(/redacted/)[0]);
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    userEvent.hover(screen.getAllByText(/redacted/)[1]);
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
