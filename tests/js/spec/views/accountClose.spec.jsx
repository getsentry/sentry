import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import AccountClose from 'app/views/settings/account/accountClose';

describe('AccountClose', function() {
  let deleteMock;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/?owner=1',
      body: [
        {
          organization: TestStubs.Organization(),
          singleOwner: true,
        },
        {
          organization: TestStubs.Organization({
            id: '4',
            slug: 'non-single-owner',
          }),
          singleOwner: false,
        },
      ],
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'DELETE',
    });
  });

  it('lists all orgs user is an owner of', function() {
    const wrapper = mountWithTheme(<AccountClose />, TestStubs.routerContext());

    // Input for single owner org
    expect(
      wrapper
        .find('input')
        .first()
        .prop('checked')
    ).toBe(true);
    expect(
      wrapper
        .find('input')
        .first()
        .prop('disabled')
    ).toBe(true);

    // Input for non-single-owner org
    expect(
      wrapper
        .find('input')
        .at(1)
        .prop('checked')
    ).toBe(false);
    expect(
      wrapper
        .find('input')
        .at(1)
        .prop('disabled')
    ).toBe(false);

    // Can check 2nd org
    wrapper
      .find('input')
      .at(1)
      .simulate('change', {target: {checked: true}});

    wrapper.update();

    expect(
      wrapper
        .find('input')
        .at(1)
        .prop('checked')
    ).toBe(true);

    // Delete
    wrapper.find('Confirm Button').simulate('click');

    // First button is cancel, target Button at index 2
    wrapper
      .find('Modal Button')
      .at(1)
      .simulate('click');

    expect(deleteMock).toHaveBeenCalledWith(
      '/users/me/',
      expect.objectContaining({
        data: {
          organizations: ['org-slug', 'non-single-owner'],
        },
      })
    );
  });
});
