import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'sentry/api';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import CommitterStore from 'sentry/stores/committerStore';
import MemberListStore from 'sentry/stores/memberListStore';

describe('SuggestedOwners', function () {
  const user = TestStubs.User();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}`;

  beforeEach(function () {
    MemberListStore.loadInitialData([user, TestStubs.CommitAuthor()]);
    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
      body: [],
    });
    Client.addMockResponse({
      url: `/prompts-activity/`,
      body: {},
    });
    Client.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/`,
      query: {project: -1},
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    Client.clearMockResponses();
    CommitterStore.reset();
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
    await tick(); // Run Store.load and fire Action.loadSuccess
    await tick(); // Run Store.loadSuccess
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
    await tick(); // Run Store.load and fire Action.loadSuccess
    await tick(); // Run Store.loadSuccess
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
    await tick(); // Run Store.load and fire Action.loadSuccess
    await tick(); // Run Store.loadSuccess
    wrapper.update();

    expect(wrapper.find('ActorAvatar')).toHaveLength(1);

    const hovercardProps = wrapper.find('SuggestedOwnerHovercard').props();
    expect(hovercardProps.commits).not.toBeUndefined();
    expect(hovercardProps.rules).not.toBeUndefined();
  });
});
