import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutomationAlertPreviewTable} from 'sentry/views/automations/components/automationAlertPreviewTable';

const organization = OrganizationFixture();
const groupsUrl = `/organizations/${organization.slug}/issues/`;

describe('AutomationAlertPreviewTable', () => {
  it('groups unthrottled results by issue', async () => {
    const group = GroupFixture({id: '123', title: 'A preview issue'});
    const previews = [
      {
        results: [
          {
            groupId: group.id,
            triggeredAt: '2026-09-24T12:00:00Z',
            isThrottled: false,
          },
          {
            groupId: group.id,
            triggeredAt: '2026-09-24T11:00:00Z',
            isThrottled: false,
          },
          {
            groupId: group.id,
            triggeredAt: '2026-09-24T10:00:00Z',
            isThrottled: true,
          },
        ],
      },
    ];
    const groupsRequest = MockApiClient.addMockResponse({
      url: groupsUrl,
      body: [{id: group.id, title: group.title, project: group.project}],
    });

    render(
      <AutomationAlertPreviewTable
        previews={previews}
        projectIds={[1]}
        isLoading={false}
      />,
      {organization}
    );

    expect(await screen.findByText('A preview issue')).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
    expect(groupsRequest).toHaveBeenCalledWith(
      groupsUrl,
      expect.objectContaining({
        query: {
          group: [group.id],
          project: [1],
          collapse: ['stats', 'unhandled'],
        },
      })
    );
  });
});
