import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AccountSubscriptions from 'sentry/views/settings/account/accountSubscriptions';

const ENDPOINT = '/users/me/subscriptions/';

describe('AccountSubscriptions', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    const wrapper = render(<AccountSubscriptions />, {
      context: TestStubs.routerContext(),
    });

    expect(wrapper.container).toSnapshot();
  });

  it('renders list and can toggle', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.Subscriptions(),
    });
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
    render(<AccountSubscriptions />);

    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Product & Feature Updates'})
    );

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

  it('can handle multiple email addresses', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        ...TestStubs.Subscriptions().map(x => ({...x, email: 'a@1.com'})),
        ...TestStubs.Subscriptions().map(x => ({...x, email: 'b@2.com'})),
      ],
    });
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
    render(<AccountSubscriptions />);

    await userEvent.click(
      screen.getAllByRole('checkbox', {name: 'Sentry Newsletter'})[0]
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          listId: 1,
          subscribed: true,
        },
      })
    );
  });
});
