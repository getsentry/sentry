import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import SeerOnboardingLab from 'getsentry/views/seerAutomation/onboardingLab';

const superuserOrganization = OrganizationFixture({
  access: ['org:read', 'org:write', 'org:superuser'],
  features: ['seat-based-seer-enabled'],
});

/** Re-read the dialog: the install pipeline tears the onboarding modal down. */
function dialog() {
  return screen.getByRole('dialog');
}

describe('SeerOnboardingLab', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // No connected repos, so the lab falls back to the fixture catalogue and the
    // scenarios stay deterministic.
    MockApiClient.addMockResponse({url: '/organizations/org-slug/repos/', body: []});
  });

  it('hides itself from users without superuser access', () => {
    render(<SeerOnboardingLab />, {organization: OrganizationFixture()});

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
    expect(screen.queryByText('Seer Onboarding Lab')).not.toBeInTheDocument();
  });

  it('shows the state of the selected scenario', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});

    expect(await screen.findByTestId('lab-state-entitlement')).toHaveTextContent('none');

    await userEvent.click(screen.getByRole('radio', {name: /Fully configured/}));

    expect(screen.getByTestId('lab-state-entitlement')).toHaveTextContent('seat-based');
    expect(screen.getByTestId('lab-state-stoppingPoints')).toHaveTextContent(
      'frontend: create_pr, backend: create_pr'
    );
    expect(screen.getByTestId('lab-state-repoLinks')).toHaveTextContent(
      'acme/web → frontend, acme/api → backend'
    );
  });

  it('falls back to fixtures when the org has no connected repositories', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});

    expect(await screen.findByText(/This org \(0 repos/)).toBeInTheDocument();
    // The catalogue is empty, so the scenario keeps its fixture repositories.
    expect(screen.getByTestId('lab-state-repoLinks')).toHaveTextContent('[]');

    await userEvent.click(screen.getByRole('radio', {name: /Fully configured/}));
    expect(screen.getByTestId('lab-state-repoLinks')).toHaveTextContent('acme/web');
  });

  it('hands back to onboarding after the install pipeline takes the modal over', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('radio', {name: /No source code/}));
    await userEvent.click(screen.getByRole('button', {name: 'Open modal'}));
    await userEvent.click(within(dialog()).getByRole('button', {name: 'Connect GitHub'}));

    // The pipeline has replaced the onboarding modal, not stacked on it.
    expect(within(dialog()).getByText('Add Installation')).toBeInTheDocument();
    expect(within(dialog()).queryByText('Set up Seer Autofix')).not.toBeInTheDocument();

    await userEvent.click(within(dialog()).getByRole('button', {name: 'Finish install'}));

    // ...and finishing hands us back, past the step we just completed.
    expect(within(dialog()).getByText('Set up Seer Autofix')).toBeInTheDocument();
    expect(
      within(dialog()).getByRole('button', {name: 'Connect a repository'})
    ).toBeInTheDocument();
    expect(screen.getByTestId('lab-state-hasSupportedScmIntegration')).toHaveTextContent(
      'true'
    );
  });

  it('abandons nothing when the install pipeline is cancelled', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('radio', {name: /No source code/}));
    await userEvent.click(screen.getByRole('button', {name: 'Open modal'}));
    await userEvent.click(within(dialog()).getByRole('button', {name: 'Connect GitHub'}));
    await userEvent.click(within(dialog()).getByRole('button', {name: 'Cancel'}));

    // Cancelling leaves no modal, so the page's Open modal button gets you back.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('lab-state-hasSupportedScmIntegration')).toHaveTextContent(
      'false'
    );
  });

  it('simulates buying Seer from the set-up-but-unpaid scenario', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('radio', {name: /Set up, but no Seer plan/})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Open modal'}));

    expect(
      within(dialog()).getByText('Autofix is ready and waiting')
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog()).getByRole('button', {name: 'Add Seer to your plan'})
    );

    expect(within(dialog()).getByText('Autofix is ready')).toBeInTheDocument();
    expect(screen.getByTestId('lab-state-entitlement')).toHaveTextContent('seat-based');
  });

  it('walks an unpaid org all the way from nothing to ready', async () => {
    render(<SeerOnboardingLab />, {organization: superuserOrganization});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('radio', {name: /Brand new org/}));
    await userEvent.click(screen.getByRole('button', {name: 'Open modal'}));

    // No plan, but setup is not gated on billing.
    expect(
      within(dialog()).getByText(/Seer is not on this plan yet/)
    ).toBeInTheDocument();

    // Connect the SCM integration, through the pipeline hand-off.
    await userEvent.click(within(dialog()).getByRole('button', {name: 'Connect GitHub'}));
    await userEvent.click(within(dialog()).getByRole('button', {name: 'Finish install'}));

    // Link a repository to a project.
    await userEvent.click(
      within(dialog()).getByRole('button', {name: 'Connect a repository'})
    );
    await userEvent.click(
      within(dialog()).getByRole('button', {name: 'Select a repository'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'acme/web'}));
    await userEvent.click(
      within(dialog()).getByRole('button', {name: 'Select a project'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'frontend'}));

    expect(screen.getByTestId('lab-state-repoLinks')).toHaveTextContent(
      'acme/web → frontend'
    );

    // Turn automation up to opening pull requests.
    await userEvent.click(within(dialog()).getByRole('button', {name: 'No Automation'}));
    await userEvent.click(screen.getByRole('option', {name: 'Stop after PR drafted'}));

    expect(screen.getByTestId('lab-state-stoppingPoints')).toHaveTextContent(
      'frontend: create_pr'
    );

    // Setup is done, but Seer still is not paid for.
    expect(
      within(dialog()).getByText('Autofix is ready and waiting')
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog()).getByRole('button', {name: 'Add Seer to your plan'})
    );
    expect(within(dialog()).getByText('Autofix is ready')).toBeInTheDocument();
  });
});
