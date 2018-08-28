import React from 'react';
import {mount} from 'enzyme';

import ReleaseDetails from 'app/views/releaseDetails';

describe('ReleaseDetails', function() {
  let deleteMock;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/projects/acme/anvils/releases/9.1.1/',
      body: {
        version: '9.1.1',
        ref: 'some-tag',
        dateCreated: '2018-10-30',
        dateReleased: '2018-08-30',
        url: 'http://example.com/api/v1/docs',
        newGroups: 0,
        firstEvent: null,
        lastEvent: null,
      },
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/acme/releases/9.1.1/',
      method: 'DELETE',
      status: 204,
    });
  });

  it('shows release details', function() {
    let noop = () => {};
    let params = {
      orgId: 'acme',
      projectId: 'anvils',
      project: {
        slug: 'anvils',
      },
      version: '9.1.1',
    };
    let location = {
      pathname: '/',
    };

    let wrapper = mount(
      <ReleaseDetails location={location} params={params} setProjectNavSection={noop}>
        <div>hi</div>
      </ReleaseDetails>,
      TestStubs.routerContext()
    );

    // Click delete button
    wrapper
      .find('button[aria-label="Delete"]')
      .first()
      .simulate('click');

    wrapper.update();

    // Click on ok button which is at index 2
    wrapper
      .find('Modal Button')
      .at(1)
      .simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
