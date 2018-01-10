import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import AccountEmails from 'app/views/settings/account/accountEmails';

jest.mock('scroll-to-element', () => {});

const ENDPOINT = '/account/emails/';

describe('AccountEmails', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.AccountEmails(),
    });
  });

  it('renders with emails', function() {
    let wrapper = shallow(<AccountEmails />, TestStubs.routerContext());

    expect(wrapper).toMatchSnapshot();
  });

  it('can remove an email', function() {
    let mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      statusCode: 200,
    });

    let wrapper = mount(<AccountEmails />, TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    // The first Button should be delete button for first secondary email (NOT primary)
    wrapper
      .find('Button')
      .first()
      .simulate('click');

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

  it('can add a secondary email', function() {
    let mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });
    let wrapper = mount(<AccountEmails />, TestStubs.routerContext());

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
