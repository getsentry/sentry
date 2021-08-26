import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import AccountEmails from 'app/views/settings/account/accountEmails';

jest.mock('scroll-to-element', () => {});

const ENDPOINT = '/users/me/emails/';

describe('AccountEmails', function () {
  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.AccountEmails(),
    });
  });

  it('renders with emails', function () {
    const wrapper = mountWithTheme(<AccountEmails />, TestStubs.routerContext());

    expect(wrapper).toSnapshot();
  });

  it('can remove an email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(<AccountEmails />, TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    // The first Button should be delete button for first secondary email (NOT primary)
    wrapper.find('[data-test-id="remove"]').at(1).simulate('click');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'DELETE',
        data: {
          email: 'secondary1@example.com',
        },
      })
    );
  });

  it('can change a secondary email to primary an email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(<AccountEmails />, TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    // The first Button should be delete button for first secondary email (NOT primary)
    wrapper.find('Button[children="Set as primary"]').first().simulate('click');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          email: 'secondary1@example.com',
        },
      })
    );
  });

  it('can resend verification email', function () {
    const mock = Client.addMockResponse({
      url: `${ENDPOINT}confirm/`,
      method: 'POST',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(<AccountEmails />, TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('Button[children="Resend verification"]').simulate('click');

    expect(mock).toHaveBeenCalledWith(
      `${ENDPOINT}confirm/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          email: 'secondary2@example.com',
        },
      })
    );
  });

  it('can add a secondary email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });
    const wrapper = mountWithTheme(<AccountEmails />, TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    wrapper
      .find('input')
      .first()
      .simulate('change', {target: {value: 'test@example.com'}})
      .simulate('blur');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        data: {
          email: 'test@example.com',
        },
      })
    );
  });
});
