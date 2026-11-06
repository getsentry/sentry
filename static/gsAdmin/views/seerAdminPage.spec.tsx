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

    await selectEvent.select(screen.getAllByRole('textbox', {name: 'Region'})[0]!, 'EU');
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

  it('retries autofix runs and shows per-run results', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/retry/',
      method: 'POST',
      body: {
        results: [
          {run_id: 1, retried: true, step: 'root_cause'},
          {run_id: 2, retried: false, reason: "Run status is 'completed', not 'error'"},
        ],
      },
    });

    render(<SeerAdminPage />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Run IDs'}), '1, 2');
    await userEvent.click(screen.getByRole('button', {name: 'Retry Runs'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/autofix/retry/',
        expect.objectContaining({data: {run_ids: [1, 2]}})
      )
    );
    expect(await screen.findByText('Retried root_cause')).toBeInTheDocument();
    expect(
      screen.getByText("Skipped: Run status is 'completed', not 'error'")
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Run IDs'})).toHaveValue('');
  });

  it('does not retry autofix runs with invalid run IDs', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/retry/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Run IDs'}), '1, abc');
    await userEvent.click(screen.getByRole('button', {name: 'Retry Runs'}));

    expect(
      await screen.findByText('Enter 1-50 run IDs separated by commas or whitespace')
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('starts a single run on a Sentry issue and links to it', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/autofix/single-run/',
      method: 'POST',
      body: {
        group_id: 7,
        project_id: 1,
        run_id: 321,
        url: 'https://sentry.sentry.io/issues/7/?project=1&explorerRunId=321',
      },
    });

    render(<SeerAdminPage />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Issue short ID'}),
      'SENTRY-5RDF'
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Start as automated (no owner)'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Start Single Run'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/autofix/single-run/',
        expect.objectContaining({
          data: {organization_slug: 'sentry', short_id: 'SENTRY-5RDF', automated: true},
        })
      )
    );
    expect(await screen.findByRole('link', {name: 'Open run 321'})).toHaveAttribute(
      'href',
      'https://sentry.sentry.io/issues/7/?project=1&explorerRunId=321'
    );
  });

  it('only allows single-run Autofix for the Sentry org', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/internal/seer/night-shift/trigger/',
      method: 'POST',
    });

    render(<SeerAdminPage />);

    const singleRun = screen.getByRole('checkbox', {
      name: 'Single-run Autofix (Sentry org only)',
    });
    expect(singleRun).toBeDisabled();

    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Organization ID (blank = all orgs)'}),
      '1'
    );
    expect(singleRun).toBeEnabled();
    await userEvent.click(singleRun);
    await userEvent.click(screen.getByRole('button', {name: 'Trigger Night Shift'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/internal/seer/night-shift/trigger/',
        expect.objectContaining({
          data: expect.objectContaining({organization_id: 1, single_run: true}),
        })
      )
    );
  });
});
