import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';
import App from 'app/views/app';

describe('Sudo Modal', function() {
  beforeEach(function() {
    ConfigStore.set('messages', []);

    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
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
        sudoRequired: true,
      },
    });
  });

  afterEach(function() {
    // trigger.mockReset();
    ConfigStore.set('messages', []);
  });

  it('can delete an org with sudo flow', function(done) {
    mount(<App />);

    let api = new Client();
    let successCb = jest.fn();
    let errorCb = jest.fn();

    // No Modal
    expect($('.modal input').length).toBe(0);

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    setTimeout(() => {
      // SudoModal
      const $input = $('.modal input');
      expect($input.length).toBe(1);

      // Original callbacks should not have been called
      expect(successCb).not.toBeCalled();
      expect(errorCb).not.toBeCalled();

      // Clear mocks and allow DELETE
      Client.clearMockResponses();
      Client.addMockResponse({
        url: '/organizations/org-slug/',
        method: 'DELETE',
        statusCode: 200,
      });
      Client.addMockResponse({
        url: '/sudo/',
        method: 'POST',
        statusCode: 200,
      });

      // "Sudo" auth
      $input.val('password');
      $('.modal [type="submit"]').click();

      expect(
        Client.getCallCount(
          Client.findMockResponse('/sudo/', {
            method: 'POST',
          })
        )
      ).toBe(1);

      setTimeout(() => {
        // Modal can be around but should be "busy"

        // Retry API request
        expect(successCb).toHaveBeenCalled();
        expect(
          Client.getCallCount(
            Client.findMockResponse('/organizations/org-slug/', {
              method: 'DELETE',
            })
          )
        ).toBe(1);
        done();
      }, 1);
    }, 1);
  });
});
