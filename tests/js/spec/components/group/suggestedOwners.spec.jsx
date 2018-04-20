import React from 'react';
import {mount} from 'enzyme';
import SuggestedOwners from 'app/components/group/suggestedOwners';
import MemberListStore from 'app/stores/memberListStore';

describe('SuggestedOwners', function() {
  const event = TestStubs.Event();
  const USER = {
    id: '1',
    name: 'Jane Doe',
    email: 'janedoe@example.com',
  };
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const group = TestStubs.Group();
  const endpoint = `/projects/${org.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function() {
    MemberListStore.loadInitialData([USER]);
    MockApiClient.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [],
        rule: [],
      },
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('should show owners when enabled', function() {
    MockApiClient.addMockResponse({
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
    let wrapper = mount(
      <SuggestedOwners
        event={event}
        group={group}
        project={project}
        org={TestStubs.Organization({
          features: new Set(['code-owners']),
        })}
      />,
      TestStubs.routerContext([{project, group}])
    );

    expect(wrapper.find('.avatar-grid-item')).toHaveLength(1);

    expect(wrapper.find('.avatar-grid-item')).toMatchSnapshot();
  });

  it('should not show owners committers without featureflag', function() {
    MockApiClient.addMockResponse({
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
    let wrapper = mount(
      <SuggestedOwners event={event} group={group} project={project} org={org} />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('.avatar-grid-item')).toHaveLength(0);
  });

  it('always displays Suggest Owners box', function() {
    let wrapper = mount(
      <SuggestedOwners event={event} group={group} project={project} org={org} />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('h6')).toHaveLength(1);
  });

  it('does not have Add Rule button without feature-flag', function() {
    let wrapper = mount(
      <SuggestedOwners event={event} group={group} project={project} org={org} />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('Tooltip Button')).toHaveLength(0);

    wrapper = mount(
      <SuggestedOwners
        event={event}
        group={group}
        project={project}
        org={TestStubs.Organization({
          features: new Set(['code-owners']),
        })}
      />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('Tooltip Button')).toHaveLength(1);
  });

  it('does allow Add Rule button to be clicked without `project:write`', function() {
    let wrapper = mount(
      <SuggestedOwners
        event={event}
        group={group}
        project={project}
        org={TestStubs.Organization({
          features: new Set(['code-owners']),
        })}
      />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('Tooltip Button')).toHaveLength(1);
    expect(wrapper.find('Tooltip').prop('disabled')).toBe(true);

    wrapper = mount(
      <SuggestedOwners
        event={event}
        group={group}
        project={project}
        org={TestStubs.Organization({
          access: [],
          features: new Set(['code-owners']),
        })}
      />,
      TestStubs.routerContext([{project, group}])
    );
    expect(wrapper.find('Tooltip Button')).toHaveLength(1);
    // Button should be disabled, tooltip should be enabled
    expect(wrapper.find('Tooltip').prop('disabled')).toBe(false);
  });
});
