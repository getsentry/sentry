import {ActorFixture} from 'sentry-fixture/actor';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';
import type {Committer} from 'sentry/types/integrations';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import type {EventOwners} from 'sentry/views/issueDetails/header/getOwnerList';

describe('GroupHeaderAssigneeSelector', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const project = ProjectFixture();
  const event = EventFixture();

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
    expect(screen.getByRole('button', {name: 'Ownership'})).toBeInTheDocument();
  });

  it('uses assignment activity for self-assignment tooltip details', async () => {
    const assignedUser = UserFixture({
      id: '91',
      email: 'frodo@sentry.io',
      name: 'Frodo',
    });
    const assignedGroup = GroupFixture({
      assignedTo: {id: assignedUser.id, name: assignedUser.name, type: 'user'},
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: assignedUser.id,
            assigneeType: 'user',
          },
          user: assignedUser,
        },
      ],
      owners: [
        {
          type: 'suspectCommit',
          owner: `user:${assignedUser.id}`,
          date_added: '',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rule: ['path', ''], rules: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            author: assignedUser,
            commits: [],
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [MemberFixture({user: assignedUser})],
    });

    render(
      <GroupHeaderAssigneeSelector
        group={assignedGroup}
        project={project}
        event={event}
      />
    );

    await userEvent.hover(await screen.findByText(assignedUser.name));
    const tooltipLine = await screen.findByText('Self-assigned');

    expect(tooltipLine.closest('[data-tooltip="true"]')?.textContent).toBe(
      `Assigned to ${assignedUser.name}Self-assigned`
    );
  });

  it('shows assignment provenance from matching assignment activity', async () => {
    const assignedUser = UserFixture({
      id: '91',
      email: 'frodo@sentry.io',
      name: 'Frodo',
    });
    const ownershipRule = 'path:./app/components/group/* #issue-workflow';
    const assignedGroup = GroupFixture({
      assignedTo: {id: assignedUser.id, name: assignedUser.name, type: 'user'},
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: assignedUser.id,
            assigneeType: 'user',
            integration: 'projectOwnership',
            rule: ownershipRule,
          },
          user: null,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rule: ['path', ''], rules: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [MemberFixture({user: assignedUser})],
    });

    render(
      <GroupHeaderAssigneeSelector
        group={assignedGroup}
        project={project}
        event={event}
      />
    );

    await userEvent.hover(await screen.findByText(assignedUser.name));
    const tooltipLine = await screen.findByText('Matching Issue Owners Rule');

    expect(tooltipLine.closest('[data-tooltip="true"]')?.textContent).toBe(
      `Assigned to ${assignedUser.name}Matching Issue Owners Rule`
    );
  });
});
