import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PriorityLevel} from 'sentry/types/group';

import {OverviewIssuePriority} from './overviewIssuePriority';

describe('OverviewIssuePriority', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  it('updates the local priority after mutation', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {data: {dismissed_ts: null}},
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
      body: {priority: PriorityLevel.HIGH},
    });

    render(
      <OverviewIssuePriority
        groupId={group.id}
        projectId={group.project.id}
        priority={PriorityLevel.MEDIUM}
      />,
      {organization}
    );

    const priorityDropdown = screen.getByRole('button', {
      name: 'Modify issue priority',
    });
    expect(within(priorityDropdown).getByText('Med')).toBeInTheDocument();

    await userEvent.click(priorityDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/issues/`,
        expect.objectContaining({
          data: expect.objectContaining({priority: PriorityLevel.HIGH}),
        })
      )
    );

    expect(
      within(
        await screen.findByRole('button', {name: 'Modify issue priority'})
      ).getByText('High')
    ).toBeInTheDocument();
  });
});
