import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import ApiApplications from 'app/views/settings/account/apiApplications';

describe('ApiApplications', function() {
  let requestMock;
  let wrapper;
  const {router, routerContext} = initializeOrg();

  const createWrapper = props => {
    wrapper = mountWithTheme(<ApiApplications {...props} />, routerContext);
  };

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [TestStubs.ApiApplication()],
    });
  });

  afterEach(function() {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  it('renders empty', async function() {
    requestMock = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: [],
    });
    createWrapper();
    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });

  it('renders', async function() {
    createWrapper();

    expect(requestMock).toHaveBeenCalled();

    expect(wrapper.find('ApiApplicationRow')).toHaveLength(1);
  });

  it('creates application', async function() {
    const createApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/',
      body: TestStubs.ApiApplication({
        id: '234',
      }),
      method: 'POST',
    });
    createWrapper();

    wrapper.find('Button').simulate('click');
    expect(createApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/',
      expect.objectContaining({method: 'POST'})
    );
    expect(router.push).toHaveBeenLastCalledWith(
      '/settings/account/api/applications/234/'
    );
  });

  it('deletes application', async function() {
    const deleteApplicationRequest = MockApiClient.addMockResponse({
      url: '/api-applications/123/',
      method: 'DELETE',
    });
    createWrapper();

    wrapper.find('a[aria-label="Remove"]').simulate('click');
    expect(deleteApplicationRequest).toHaveBeenCalledWith(
      '/api-applications/123/',
      expect.objectContaining({method: 'DELETE'})
    );
    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
  });
});
