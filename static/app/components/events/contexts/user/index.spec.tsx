import {Event} from 'sentry-fixture/event';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  UserEventContext,
  UserEventContextData,
} from 'sentry/components/events/contexts/user';

// the values of this mock are correct and the types need to be updated
export const userMockData = {
  data: null,
  email: null,
  id: '',
  ip_address: null,
  name: null,
  username: null,
} as unknown as UserEventContextData;

export const userMetaMockData = {
  id: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 9,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
  ip_address: {
    '': {
      err: [
        [
          'invalid_data',
          {
            reason: 'expected an ip address',
          },
        ],
      ],
      len: 14,
      rem: [['project:0', 'x', 0, 0]],
      val: '',
    },
  },
};

const event = {
  ...Event(),
  _meta: {
    user: userMetaMockData,
  },
};

describe('user event context', function () {
  it('display redacted data', async function () {
    render(<UserEventContext event={event} data={userMockData} />);

    expect(screen.getByText('ID')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    await userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('IP Address')).toBeInTheDocument(); // subject
    await userEvent.hover(document.body);
    expect(screen.getByText('None')).toBeInTheDocument(); // value
    await userEvent.hover(screen.getByText('None'));

    // The content of the first tooltip is not removed from the DOM when it is hidden
    // therefore we explicitly need to wait for both tooltips to be visible
    // Fixes race condition that causes flakiness https://sentry.sentry.io/issues/3974475742/?project=4857230
    await waitFor(() => {
      const tooltips = screen.getAllByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        )
      );

      expect(tooltips).toHaveLength(2);
      expect(tooltips[1]).toBeInTheDocument();
      expect(tooltips[1]).toBeInTheDocument();
    });
  });
});
