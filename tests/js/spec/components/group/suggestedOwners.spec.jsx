import React from 'react';
import {mount} from 'enzyme';
import SuggestedOwners from 'app/components/group/suggestedOwners';
import MemberListStore from 'app/stores/memberListStore';
import {Client} from 'app/api';

describe('SuggestedOwners', function() {
  const event = TestStubs.Event();
  const user = TestStubs.User();

  const organization = TestStubs.Organization();
  const project = TestStubs.Project();

  const routerContext = TestStubs.routerContext([
    {
      group: TestStubs.Group(),
      project,
      organization,
    },
  ]);

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function() {
    MemberListStore.loadInitialData([user, TestStubs.CommitAuthor()]);
  });

  afterEach(function() {
    Client.clearMockResponses();
  });

  it('Renders suggested owners', function() {
    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [
          {
            author: TestStubs.CommitAuthor(),
            commits: [TestStubs.Commit()],
          },
        ],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [{type: 'user', ...user}],
        rules: [[['path', 'sentry/tagstore/*'], [['user', user.email]]]],
      },
    });

    const wrapper = mount(<SuggestedOwners event={event} />, routerContext);

    expect(wrapper.find('ActorAvatar')).toHaveLength(2);

    // One includes committers the other includes ownership rules
    expect(
      wrapper
        .find('SuggestedOwnerHovercard')
        .map(node => node.props())
        .some(p => p.commits === undefined && p.rules !== undefined)
    ).toBe(true);
    expect(
      wrapper
        .find('SuggestedOwnerHovercard')
        .map(node => node.props())
        .some(p => p.commits !== undefined && p.rules === undefined)
    ).toBe(true);
  });

  it('Merges owner matching rules and having suspect commits', function() {
    const author = TestStubs.CommitAuthor();

    Client.addMockResponse({
      url: `${endpoint}/committers/`,
      body: {
        committers: [{author, commits: [TestStubs.Commit()]}],
      },
    });

    Client.addMockResponse({
      url: `${endpoint}/owners/`,
      body: {
        owners: [{type: 'user', ...author}],
        rules: [[['path', 'sentry/tagstore/*'], [['user', author.email]]]],
      },
    });

    const wrapper = mount(<SuggestedOwners event={event} />, routerContext);

    expect(wrapper.find('ActorAvatar')).toHaveLength(1);

    const hovercardProps = wrapper.find('SuggestedOwnerHovercard').props();
    expect(hovercardProps.commits).not.toBeUndefined();
    expect(hovercardProps.rules).not.toBeUndefined();
  });
});
