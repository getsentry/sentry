import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SuggestedOwners from 'app/components/group/suggestedOwners/suggestedOwners';
import MemberListStore from 'app/stores/memberListStore';
import {Client} from 'app/api';

describe('SuggestedOwners', function () {
  const event = TestStubs.Event();
  const user = TestStubs.User();

  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const group = TestStubs.Group({firstRelease: {}});

  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function () {
    MemberListStore.loadInitialData([user, TestStubs.CommitAuthor()]);
  });

  afterEach(function () {
    Client.clearMockResponses();
  });

  it('Renders suggested owners', async function () {
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

    const wrapper = mountWithTheme(
      <SuggestedOwners project={project} group={group} event={event} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ActorAvatar')).toHaveLength(2);

    // One includes committers, the other includes ownership rules
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

  it('does not call committers endpoint if `group.firstRelease` does not exist', async function () {
    const committers = Client.addMockResponse({
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

    const wrapper = mountWithTheme(
      <SuggestedOwners project={project} group={TestStubs.Group()} event={event} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(committers).not.toHaveBeenCalled();
    expect(wrapper.find('ActorAvatar')).toHaveLength(1);
  });

  it('Merges owner matching rules and having suspect commits', async function () {
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

    const wrapper = mountWithTheme(
      <SuggestedOwners project={project} group={group} event={event} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ActorAvatar')).toHaveLength(1);

    const hovercardProps = wrapper.find('SuggestedOwnerHovercard').props();
    expect(hovercardProps.commits).not.toBeUndefined();
    expect(hovercardProps.rules).not.toBeUndefined();
  });
});
