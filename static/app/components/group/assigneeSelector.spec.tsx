import {GroupFixture} from 'sentry-fixture/group';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';

describe('AssigneeSelector', () => {
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
