import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';

import {SeerAdminPage} from 'admin/views/seerAdminPage';

describe('SeerAdminPage', () => {
  beforeEach(() => {
    ConfigStore.set('localities', [
      {
        name: 'US',
        url: 'https://us.example.com',
      },
      {
        name: 'EU',
        url: 'https://eu.example.com',
      },
    ]);
  });

  it('only clears the organization ID after triggering a night shift run', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/night-shift/trigger/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    const organizationId = screen.getByRole('spinbutton', {
      name: 'Organization ID (blank = all orgs)',
    });
    const maxCandidates = screen.getByRole('spinbutton', {
      name: 'Max candidates (optional)',
    });
    const dryRun = screen.getByRole('checkbox', {
      name: 'Dry run (triage only, no autofix triggered)',
    });

    await selectEvent.select(screen.getByRole('textbox', {name: 'Region'}), 'EU');
    await userEvent.type(organizationId, '123');
    await userEvent.type(maxCandidates, '5');
    await userEvent.click(dryRun);
    await userEvent.click(screen.getByRole('button', {name: 'Trigger Night Shift'}));

    await waitFor(() => expect(request).toHaveBeenCalled());
    await waitFor(() => expect(organizationId).toHaveValue(null));
    expect(maxCandidates).toHaveValue(5);
    expect(dryRun).toBeChecked();
    expect(screen.getByText('EU')).toBeInTheDocument();
  });
});
