import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MonitorCleanupTrigger} from 'admin/views/monitorCleanupTrigger';

it('requires an organization and links to the manually triggered run', async () => {
  const trigger = MockApiClient.addMockResponse({
    url: '/internal/seer/monitor-cleanup/trigger/',
    method: 'POST',
    body: {
      runId: '12',
      url: '/organizations/org-slug/issues/autofix/workflows/?runId=12',
    },
  });
  render(<MonitorCleanupTrigger host="http://localhost:8000" />);
  expect(screen.getByRole('button', {name: 'Find duplicate monitors'})).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', {name: 'Organization ID'}), '1');
  await userEvent.click(screen.getByRole('button', {name: 'Find duplicate monitors'}));
  expect(await screen.findByRole('button', {name: 'View scan 12'})).toBeInTheDocument();
  expect(trigger).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({data: {organizationId: 1}})
  );
});
