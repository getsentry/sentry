import React from 'react';
import {shallow} from 'enzyme';

import {GroupSidebar} from 'app/components/group/sidebar';

describe('GroupSidebar', function() {
  let group = TestStubs.Group({tags: TestStubs.Tags()});
  let environment = {name: 'production', displayName: 'Production', id: '1'};
  let wrapper;
  let tagValuesMock;

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/issues/1/participants/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/issues/1/',
      body: group,
    });

    tagValuesMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.TagValues(),
    });

    wrapper = shallow(
      <GroupSidebar group={group} event={TestStubs.Event()} environment={environment} />,
      TestStubs.routerContext()
    );
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('sidebar', function() {
    it('should make a request to the /tags/ endpoint to get top values', function() {
      expect(tagValuesMock).toHaveBeenCalled();
    });
  });

  describe('renders with tags', function() {
    it('renders', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders tags', function() {
      expect(wrapper.find('[data-test-id="group-tag"]')).toHaveLength(4);
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
          group={group}
          event={TestStubs.Event()}
          environment={environment}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders no tags', function() {
      expect(wrapper.find('[data-test-id="group-tag"]')).toHaveLength(0);
    });

    it('renders empty text', function() {
      expect(wrapper.find('[data-test-id="no-tags"]').text()).toBe(
        'No tags found in the Production environment'
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
});
