import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
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
  ...TestStubs.Event(),
  _meta: {
    user: userMetaMockData,
  },
};

describe('user event context', function () {
  it('display redacted data', async function () {
    render(<UserEventContext event={event} data={userMockData} />);

    expect(screen.getByText('ID')).toBeInTheDocument(); // subject
    expect(screen.getByText(/redacted/)).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('IP Address')).toBeInTheDocument(); // subject
    expect(screen.getByText('None')).toBeInTheDocument(); // value
    userEvent.hover(screen.getByText('None'));
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          "Removed because of a data scrubbing rule in your project's settings"
        ) // Fall back case
      )
    ).toBeInTheDocument(); // tooltip description
  });
});
