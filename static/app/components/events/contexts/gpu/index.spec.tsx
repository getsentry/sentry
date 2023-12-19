import {DataScrubbingRelayPiiConfig} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GPUEventContext} from 'sentry/components/events/contexts/gpu';
import {GPUData} from 'sentry/components/events/contexts/gpu/types';

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

const event = EventFixture({
  _meta: {
    contexts: {
      gpu: gpuMetaMockData,
    },
  },
});

// Flaky test https://github.com/getsentry/sentry/actions/runs/4465585304/jobs/7842795315?pr=45984
// eslint-disable-next-line
describe.skip('gpu event context', function () {
  it('display redacted data', async function () {
    render(<GPUEventContext event={event} data={gpuMockData} />, {
      organization: {
        relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfig()),
      },
    });

    expect(screen.getByText('API Type')).toBeInTheDocument(); // subject
    await userEvent.hover(screen.getAllByText(/redacted/)[0]);
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('Name')).toBeInTheDocument(); // subject
    await userEvent.hover(screen.getAllByText(/redacted/)[1]);
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in your organization's settings"
        )
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
