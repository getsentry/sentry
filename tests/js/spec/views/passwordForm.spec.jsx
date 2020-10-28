import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import PasswordForm from 'app/views/settings/account/passwordForm';

const ENDPOINT = '/users/me/password/';

describe('PasswordForm', function () {
  let wrapper;
  let putMock;
  const routerContext = TestStubs.routerContext([
    {
      router: {
        ...TestStubs.router(),
        params: {
          authId: 15,
        },
      },
    },
  ]);

  beforeEach(function () {
    Client.clearMockResponses();
    putMock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });
    wrapper = mountWithTheme(<PasswordForm />, routerContext);
  });

  it('has 3 text inputs', function () {
    expect(wrapper.find('input[type="password"]')).toHaveLength(3);
  });

  it('does not submit when any password field is empty', function () {
    wrapper.find('input[name="password"]').simulate('change', {target: {value: 'test'}});
    wrapper.find('form').simulate('submit');
    expect(putMock).not.toHaveBeenCalled();

    wrapper.find('input[name="password"]').simulate('change', {target: {value: ''}});
    wrapper
      .find('input[name="passwordNew"]')
      .simulate('change', {target: {value: 'test'}});
    wrapper
      .find('input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'test'}});
    wrapper.find('form').simulate('submit');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('does not submit when new passwords dont match', function () {
    wrapper.find('input[name="password"]').simulate('change', {target: {value: 'test'}});
    wrapper
      .find('input[name="passwordNew"]')
      .simulate('change', {target: {value: 'test'}});
    wrapper
      .find('input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'nottest'}});
    wrapper.find('form').simulate('submit');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('calls API when all fields are validated and clears form on success', function (done) {
    wrapper.find('input[name="password"]').simulate('change', {target: {value: 'test'}});
    wrapper
      .find('input[name="passwordNew"]')
      .simulate('change', {target: {value: 'nottest'}});
    wrapper
      .find('input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'nottest'}});
    wrapper.find('form').simulate('submit');
    expect(putMock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          password: 'test',
          passwordNew: 'nottest',
          passwordVerify: 'nottest',
        },
      })
    );

    setTimeout(() => {
      wrapper.update();
      expect(wrapper.find('input[name="password"]').prop('value')).toBe('');
      done();
    }, 1);
  });

  it('validates mismatched passwords and remvoes validation on match', function () {
    wrapper.find('input[name="password"]').simulate('change', {target: {value: 'test'}});
    wrapper
      .find('input[name="passwordNew"]')
      .simulate('change', {target: {value: 'nottest'}});
    wrapper
      .find('input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'nottest-mismatch'}});

    const error = wrapper.find('Field[id="passwordVerify"] FieldErrorReason');

    expect(error.exists()).toBe(true);
    expect(error.text()).toBe('Passwords do not match');

    wrapper
      .find('input[name="passwordVerify"]')
      .simulate('change', {target: {value: 'nottest'}});

    expect(wrapper.find('Field[id="passwordVerify"] FieldErrorReason').exists()).toBe(
      false
    );
  });
});
