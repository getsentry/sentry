import {ActorFixture} from 'sentry-fixture/actor';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {EventOwners} from 'sentry/components/group/assignedTo';
import MemberListStore from 'sentry/stores/memberListStore';
import type {Committer} from 'sentry/types/integrations';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/streamline/header/assigneeSelector';

describe('GroupHeaderAssigneeSelector', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const project = ProjectFixture();
  const event = EventFixture();

  beforeEach(() => {
    MemberListStore.reset();
  });

  it('should render suggested assignees', async () => {
    const commitUser = UserFixture({id: '91', email: 'frodo@sentry.io', name: 'Frodo'});
    const committer: Committer = {
      author: commitUser,
      commits: [],
    };
    const ownerActor = ActorFixture({id: '101', email: 'sam@sentry.io', name: 'Sam'});
    const eventOwners: EventOwners = {
      owners: [ownerActor],
      rule: ['codeowners', '/issues'],
      rules: [[['codeowners', '/issues'], [['user', ownerActor.email!]]]],
    };
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: eventOwners,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {committers: [committer]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [
        MemberFixture({user: commitUser}),
        MemberFixture({user: UserFixture({...ownerActor})}),
      ],
    });
    render(<GroupHeaderAssigneeSelector group={group} project={project} event={event} />);

    await userEvent.click(await screen.findByLabelText('Modify issue assignee'));
    expect(await screen.findByText(commitUser.name)).toBeInTheDocument();
    expect(screen.getByText('Suspect commit author')).toBeInTheDocument();

    expect(screen.getByText(ownerActor.name)).toBeInTheDocument();
    expect(screen.getByText('Codeowners:/issues')).toBeInTheDocument();
  });
});
