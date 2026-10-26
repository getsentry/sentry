import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';

describe('AssigneeBadge', () => {
  const user = UserFixture({
    id: '1',
    name: 'Jane Bloggs',
    email: 'jane@example.com',
    avatar: {
      avatarType: 'upload',
      avatarUrl: 'https://example.com/avatar.jpg',
      avatarUuid: '123',
    },
  });

  it('renders the full user avatar when available', () => {
    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        assignedUser={user}
      />
    );

    expect(
      within(screen.getByTestId('assigned-avatar')).getByRole('img')
    ).toHaveAttribute('src', 'https://example.com/avatar.jpg?s=120');
  });

  it('shows the assigned user tooltip when the name is hidden', async () => {
    render(<AssigneeBadge assignedTo={{id: user.id, name: user.name, type: 'user'}} />);

    await userEvent.hover(screen.getByTestId('assigned-avatar'));

    expect(await screen.findByText(`Assigned to ${user.name}`)).toBeInTheDocument();
  });

  it('shows the assigned user tooltip when the name is visible', async () => {
    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        showLabel
      />
    );

    expect(screen.getByText(user.name)).toBeInTheDocument();

    await userEvent.hover(screen.getByText(user.name));

    expect(await screen.findByText(`Assigned to ${user.name}`)).toBeInTheDocument();
  });

  it('shows the assignment reason when the name is visible', async () => {
    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        assignmentDetails={{source: 'ownershipRule'}}
        showLabel
      />
    );

    await userEvent.hover(screen.getByText(user.name));

    expect(await screen.findByText('Matching Issue Owners Rule')).toBeInTheDocument();
    expect(screen.getByText(`Assigned to ${user.name}`)).toBeInTheDocument();
  });

  it('shows when the assignee assigned themselves', async () => {
    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        assignmentDetails={{actorLabel: user.name, isSelfAssigned: true}}
        showLabel
      />
    );

    await userEvent.hover(screen.getByText(user.name));

    expect(await screen.findByText('Self-assigned')).toBeInTheDocument();
  });

  it('shows who assigned the assignee', async () => {
    const actorLabel = 'Sam';

    render(
      <AssigneeBadge
        assignedTo={{id: user.id, name: user.name, type: 'user'}}
        assignmentDetails={{actorLabel}}
        showLabel
      />
    );

    await userEvent.hover(screen.getByText(user.name));
    const tooltipLine = await screen.findByText(`By ${actorLabel}`);

    expect(tooltipLine.closest('[data-tooltip="true"]')?.textContent).toBe(
      `Assigned to ${user.name}By ${actorLabel}`
    );
  });
});
