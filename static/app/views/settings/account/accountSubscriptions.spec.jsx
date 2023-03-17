import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AccountSubscriptions from 'sentry/views/settings/account/accountSubscriptions';

const ENDPOINT = '/users/me/subscriptions/';

describe('AccountSubscriptions', function () {
  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders empty', function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    const wrapper = render(<AccountSubscriptions />, {
      context: TestStubs.routerContext(),
    });

    expect(wrapper.container).toSnapshot();
  });

  it('renders list and can toggle', async function () {
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Subscriptions(),
    });
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    const wrapper = render(<AccountSubscriptions />, {
      context: TestStubs.routerContext(),
    });

    expect(wrapper.container).toSnapshot();

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByTestId('switch')[0]);

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          listId: 2,
          subscribed: false,
        },
      })
    );
  });
});
