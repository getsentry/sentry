import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {Subscriptions} from 'sentry-fixture/subscriptions';

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
    render(<AccountSubscriptions />, {
      context: RouterContextFixture(),
    });
  });

  it('renders list and can toggle', async function () {
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: Subscriptions(),
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
        ...Subscriptions().map(x => ({...x, email: 'a@1.com'})),
        ...Subscriptions().map(x => ({...x, email: 'b@2.com'})),
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
