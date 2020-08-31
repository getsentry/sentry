import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import GroupSidebar from 'app/components/group/sidebar';

describe('GroupSidebar', function() {
  let group = TestStubs.Group({tags: TestStubs.Tags()});
  const {organization, project, routerContext} = initializeOrg();
  const environment = {name: 'production', displayName: 'Production', id: '1'};
  let wrapper;
  let tagsMock;

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/committers/',
      body: {committers: []},
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/owners/',
      body: {
        owners: [],
        rules: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/groups/1/integrations/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/participants/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/',
      body: group,
    });

    MockApiClient.addMockResponse({
      url: '/groups/1/external-issues/',
      body: [],
    });

    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.Tags(),
    });

    wrapper = mountWithTheme(
      <GroupSidebar
        group={group}
        project={project}
        organization={organization}
        event={TestStubs.Event()}
        environments={[environment]}
      />,
      routerContext
    );
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('sidebar', function() {
    it('should make a request to the /tags/ endpoint to get top values', function() {
      expect(tagsMock).toHaveBeenCalled();
    });
  });

  describe('renders with tags', function() {
    it('renders', function() {
      expect(wrapper.find('SuggestedOwners')).toHaveLength(1);
      expect(wrapper.find('Memo(GroupReleaseStats)')).toHaveLength(1);
      expect(wrapper.find('ExternalIssueList')).toHaveLength(1);
      expect(
        wrapper.find('GroupTagDistributionMeter[data-test-id="group-tag"]')
      ).toHaveLength(5);
    });
  });

  describe('renders without tags', function() {
    beforeEach(function() {
      group = TestStubs.Group();

      MockApiClient.addMockResponse({
        url: '/issues/1/',
        body: group,
      });
      MockApiClient.addMockResponse({
        url: '/issues/1/tags/',
        body: [],
      });

      wrapper = mountWithTheme(
        <GroupSidebar
          api={new MockApiClient()}
          group={group}
          organization={organization}
          project={project}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        routerContext
      );
    });

    it('renders no tags', function() {
      expect(wrapper.find('[data-test-id="group-tag"]')).toHaveLength(0);
    });

    it('renders empty text', function() {
      expect(wrapper.find('[data-test-id="no-tags"]').text()).toBe(
        'No tags found in the selected environments'
      );
    });
  });

  describe('environment toggle', function() {
    it('re-requests tags with correct environment', function() {
      const stagingEnv = {name: 'staging', displayName: 'Staging', id: '2'};
      expect(tagsMock).toHaveBeenCalledTimes(1);
      wrapper.setProps({environments: [stagingEnv]});
      expect(tagsMock).toHaveBeenCalledTimes(2);
      expect(tagsMock).toHaveBeenCalledWith(
        '/issues/1/tags/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['staging'],
          }),
        })
      );
    });
  });
});
