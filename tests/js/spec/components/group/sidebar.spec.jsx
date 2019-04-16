import React from 'react';
import {mount, shallow} from 'enzyme';

import {GroupSidebar} from 'app/components/group/sidebar';

describe('GroupSidebar', function() {
  let group = TestStubs.Group({tags: TestStubs.Tags()});
  const project = TestStubs.Project();
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

    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.Tags(),
    });

    wrapper = mount(
      <GroupSidebar
        api={new MockApiClient()}
        group={group}
        project={project}
        event={TestStubs.Event()}
        environments={[environment]}
      />,
      TestStubs.routerContext()
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
      expect(wrapper.find('GroupReleaseStats')).toHaveLength(1);
      expect(wrapper.find('ExternalIssueList')).toHaveLength(1);
      expect(wrapper.find('TagDistributionMeter[data-test-id="group-tag"]')).toHaveLength(
        5
      );
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

      wrapper = shallow(
        <GroupSidebar
          api={new MockApiClient()}
          group={group}
          project={project}
          event={TestStubs.Event()}
          environments={[environment]}
        />,
        TestStubs.routerContext()
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

  describe('subscribing', function() {
    let issuesApi;
    beforeEach(function() {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/issues/',
        method: 'PUT',
        body: TestStubs.Group({isSubscribed: false}),
      });
    });

    it('can subscribe', function() {
      const btn = wrapper.find('.btn-subscribe');

      btn.simulate('click');

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isSubscribed: true},
        })
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
