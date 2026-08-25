import {GroupFixture} from 'sentry-fixture/group';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';
import {TeamStore} from 'sentry/stores/teamStore';

describe('AssigneeSelector', () => {
  it('uses the avatar directly as an interactive trigger', async () => {
    const assignedUser = UserFixture({
      id: '91',
      email: 'frodo@example.com',
      name: 'Frodo',
    });
    const group = GroupFixture({
      assignedTo: {id: assignedUser.id, name: assignedUser.name, type: 'user'},
    });

    render(
      <AssigneeSelector
        avatarOnly
        group={group}
        memberList={[assignedUser]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
      />
    );

    const trigger = screen.getByRole('button', {name: 'Modify issue assignee'});
    expect(trigger).toHaveAttribute('data-avatar-shape', 'circle');
    expect(screen.getByTestId('assigned-avatar')).toHaveStyle({
      borderRadius: '50%',
      height: '28px',
      width: '28px',
    });

    await userEvent.click(trigger);
    expect(await screen.findByRole('button', {name: 'Clear'})).toBeInTheDocument();
  });

  it('uses a square avatar and trigger for an assigned team', async () => {
    const assignedTeam = TeamFixture({id: '92', name: 'The Fellowship'});
    TeamStore.loadInitialData([assignedTeam]);
    const group = GroupFixture({
      assignedTo: {id: assignedTeam.id, name: assignedTeam.name, type: 'team'},
    });

    render(
      <AssigneeSelector
        avatarOnly
        group={group}
        memberList={[]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
      />
    );

    const trigger = screen.getByRole('button', {name: 'Modify issue assignee'});
    expect(trigger).toHaveAttribute('data-avatar-shape', 'square');
    expect(screen.getByTestId('assigned-avatar')).toHaveStyle({
      borderRadius: '3px',
      height: '28px',
      width: '28px',
    });

    await userEvent.click(trigger);
    expect(await screen.findByRole('button', {name: 'Clear'})).toBeInTheDocument();
  });

  it('shows suggested assignees instead of an unassigned placeholder', async () => {
    const suggestedUser = UserFixture({id: '93', name: 'Samwise'});
    const group = GroupFixture({
      assignedTo: null,
      owners: [
        {
          type: 'seerSuggested',
          owner: `user:${suggestedUser.id}`,
          date_added: '',
        },
      ],
    });

    render(
      <AssigneeSelector
        avatarOnly
        group={group}
        memberList={[suggestedUser]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('suggested-avatar-stack')).toHaveTextContent('S');
    expect(screen.queryByTestId('unassigned-avatar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue assignee'}));
    expect(
      await screen.findByRole('button', {name: 'Invite Member'})
    ).toBeInTheDocument();
  });

  it('uses a user icon when there is no assignee or suggestion', async () => {
    render(
      <AssigneeSelector
        avatarOnly
        group={GroupFixture({assignedTo: null, owners: []})}
        memberList={[]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('unassigned-avatar').tagName).toBe('svg');
    expect(screen.queryByTestId('suggested-avatar-stack')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue assignee'}));
    expect(
      await screen.findByRole('button', {name: 'Invite Member'})
    ).toBeInTheDocument();
  });

  it('uses the assigned owner source as fallback tooltip details', async () => {
    const assignedUser = UserFixture({
      id: '91',
      email: 'frodo@example.com',
      name: 'Frodo',
    });
    const group = GroupFixture({
      assignedTo: {id: assignedUser.id, name: assignedUser.name, type: 'user'},
      owners: [
        {
          type: 'suspectCommit',
          owner: `user:${assignedUser.id}`,
          date_added: '',
        },
      ],
    });

    render(
      <AssigneeSelector
        group={group}
        memberList={[assignedUser]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
        showLabel
      />
    );

    await userEvent.hover(await screen.findByText(assignedUser.name));
    const tooltipLine = await screen.findByText('Based on commit data');

    expect(tooltipLine.closest('[data-tooltip="true"]')?.textContent).toBe(
      `Assigned to ${assignedUser.name}Based on commit data`
    );
  });

  it('uses explicit empty assignment details instead of the owner source fallback', async () => {
    const assignedUser = UserFixture({
      id: '91',
      email: 'frodo@example.com',
      name: 'Frodo',
    });
    const group = GroupFixture({
      assignedTo: {id: assignedUser.id, name: assignedUser.name, type: 'user'},
      owners: [
        {
          type: 'suspectCommit',
          owner: `user:${assignedUser.id}`,
          date_added: '',
        },
      ],
    });

    render(
      <AssigneeSelector
        group={group}
        memberList={[assignedUser]}
        assigneeLoading={false}
        handleAssigneeChange={jest.fn()}
        showLabel
        useOwnerAssignmentDetails={false}
      />
    );

    await userEvent.hover(await screen.findByText(assignedUser.name));
    const tooltipLine = await screen.findByText(`Assigned to ${assignedUser.name}`);

    expect(tooltipLine.closest('[data-tooltip="true"]')?.textContent).toBe(
      `Assigned to ${assignedUser.name}`
    );
  });
});
