import {SubscriptionsFixture} from 'sentry-fixture/subscriptions';

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
    render(<AccountSubscriptions />);
  });

  it('renders list and can toggle', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: SubscriptionsFixture(),
    });
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
    render(<AccountSubscriptions />);

    expect(mock).not.toHaveBeenCalled();

    expect(await screen.findByText('Product & Feature Updates')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Product & Feature Updates'})
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: expect.objectContaining({
          listId: 2,
          subscribed: false,
        }),
      })
    );
  });

  it('can handle multiple email addresses', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: [
        ...SubscriptionsFixture().map(x => ({...x, email: 'a@1.com'})),
        ...SubscriptionsFixture().map(x => ({...x, email: 'b@2.com'})),
      ],
    });
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
    render(<AccountSubscriptions />);

    // wait for the mock GET Request to resolve
    const elements = await screen.findAllByText('Sentry Newsletter');
    expect(elements).toHaveLength(2);

    await userEvent.click(
      screen.getAllByRole('checkbox', {name: 'Sentry Newsletter'})[0]!
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: expect.objectContaining({
          listId: 1,
          subscribed: true,
        }),
      })
    );
  });
});
