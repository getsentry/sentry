import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ReleaseDetails from 'app/views/releases/detail/';
import ProjectsStore from 'app/stores/projectsStore';

describe('ReleaseDetails', function () {
  let deleteMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/acme/releases/9.1.1/',
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

  it('shows release details', async function () {
    const organization = TestStubs.Organization({slug: 'acme'});
    const params = {
      orgId: 'acme',
      projectId: 'anvils',
      project: {
        slug: 'anvils',
      },
      release: '9.1.1',
    };
    const location = {
      pathname: '/',
      query: {},
    };

    const wrapper = mountWithTheme(
      <ReleaseDetails location={location} params={params} organization={organization}>
        <div>hi</div>
      </ReleaseDetails>,
      TestStubs.routerContext()
    );

    ProjectsStore.loadInitialData(organization.projects);

    await tick();
    wrapper.update();

    // Click delete button
    wrapper.find('button[aria-label="Delete"]').first().simulate('click');

    wrapper.update();

    // Click on ok button which is at index 2
    wrapper.find('Modal Button').at(1).simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
