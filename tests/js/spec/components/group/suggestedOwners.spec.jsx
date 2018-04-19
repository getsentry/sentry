import React from 'react';
import {mount} from 'enzyme';
import SuggestedOwners from 'app/components/group/suggestedOwners';
import MemberListStore from 'app/stores/memberListStore';
import {Client} from 'app/api';
import SentryTypes from 'app/proptypes';

describe('SuggestedOwners', function() {
  let sandbox;
  const event = TestStubs.Event();
  const USER = {
    id: '1',
    name: 'Jane Doe',
    email: 'janedoe@example.com',
  };
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  beforeEach(function() {
    let endpoint = `/projects/${org.slug}/${project.slug}/events/${event.id}`;

    sandbox = sinon.sandbox.create();
    MemberListStore.loadInitialData([USER]);
    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {committers: []},
    });
    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [
          {
            type: 'user',
            id: '1',
            name: 'Jane Doe',
          },
        ],
        rule: ['path', 'sentry/tagstore/*'],
      },
    });
  });

  afterEach(function() {
    sandbox.restore();
    Client.clearMockResponses();
  });

  describe('render()', function() {
    it('should show owners when enable', function() {
      let wrapper = mount(
        <SuggestedOwners event={event} />,
        TestStubs.routerContext([
          {project: TestStubs.Project(), group: TestStubs.Group()},
          {group: SentryTypes.Group, project: SentryTypes.Project},
        ])
      );

      wrapper.setContext({
        organization: {id: '1', features: new Set(['code-owners'])},
      });

      expect(wrapper).toMatchSnapshot();
    });
    it('should not show owners committers without featureflag', function() {
      let wrapper = mount(
        <SuggestedOwners event={event} />,
        TestStubs.routerContext([
          {project: TestStubs.Project(), group: TestStubs.Group()},
          {group: SentryTypes.Group, project: SentryTypes.Project},
        ])
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
