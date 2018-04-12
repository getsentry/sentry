import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import App from 'app/views/app';
import ConfigStore from 'app/stores/configStore';

jest.mock('jquery');

describe('Sudo Modal', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    Client.addMockResponse({
      url: '/assistant/',
      body: [],
    });
    Client.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        detail: {
          code: 'sudo-required',
          username: 'test@test.com',
        },
      },
    });
    Client.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  it('can delete an org with sudo flow', async function() {
    ConfigStore.set('user', {
      ...ConfigStore.get('user'),
      hasPasswordAuth: true,
    });
    let wrapper = mount(<App>{<div>placeholder content</div>}</App>);

    let api = new Client();
    let successCb = jest.fn();
    let errorCb = jest.fn();
    let orgDeleteMock;

    // No Modal
    expect(wrapper.find('ModalDialog')).toHaveLength(0);

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog input')).toHaveLength(1);

    // Original callbacks should not have been called
    expect(successCb).not.toBeCalled();
    expect(errorCb).not.toBeCalled();

    // Clear mocks and allow DELETE
    Client.clearMockResponses();
    orgDeleteMock = Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 200,
    });
    let sudoMock = Client.addMockResponse({
      url: '/auth/',
      method: 'PUT',
      statusCode: 200,
    });

    expect(sudoMock).not.toHaveBeenCalled();

    // "Sudo" auth
    wrapper
      .find('ModalDialog input[name="password"]')
      .simulate('change', {target: {value: 'password'}});

    wrapper.find('ModalDialog form').simulate('submit');
    wrapper.find('ModalDialog Button[type="submit"]').simulate('click');

    await tick();
    wrapper.update();

    expect(sudoMock).toHaveBeenCalledWith(
      '/auth/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          password: 'password',
        },
      })
    );

    // Retry API request
    expect(successCb).toHaveBeenCalled();
    expect(orgDeleteMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    await tick();
    wrapper.update();

    // Sudo Modal should be closed
    expect(wrapper.find('ModalDialog')).toHaveLength(0);
  });

  it('shows button to redirect if user does not have password auth', async function() {
    ConfigStore.set('user', {
      ...ConfigStore.get('user'),
      hasPasswordAuth: false,
    });
    let wrapper = mount(<App>{<div>placeholder content</div>}</App>);

    let api = new Client();
    let successCb = jest.fn();
    let errorCb = jest.fn();

    // No Modal
    expect(wrapper.find('ModalDialog')).toHaveLength(0);

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog input')).toHaveLength(0);
    expect(wrapper.find('Button').prop('href')).toMatch('/auth/login/?next=blank');
  });
});
