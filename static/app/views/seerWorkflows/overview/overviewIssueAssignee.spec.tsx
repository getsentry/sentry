import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OverviewIssueAssignee} from './overviewIssueAssignee';

describe('OverviewIssueAssignee', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  it('updates the local assignment after mutation', async () => {
    const assignee = UserFixture({
      id: '42',
      name: 'Next Assignee',
      email: 'next.assignee@example.com',
    });
    const assignRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'PUT',
      body: {
        ...group,
        assignedTo: {id: assignee.id, name: assignee.name, type: 'user'},
      },
    });

    render(
      <OverviewIssueAssignee
        groupId={group.id}
        projectId={group.project.id}
        projectSlug={group.project.slug}
        memberList={[assignee]}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue assignee'}));
    await userEvent.click(
      await screen.findByRole('option', {name: new RegExp(assignee.name)})
    );

    await waitFor(() => expect(assignRequest).toHaveBeenCalled());
    expect(await screen.findByTestId('assigned-avatar')).toHaveAttribute(
      'title',
      assignee.name
    );
  });
});
