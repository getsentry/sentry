import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {getSeerOnboardingScenario} from 'sentry/components/seer/onboarding/scenarios';
import {SeerOnboardingModal} from 'sentry/components/seer/onboarding/seerOnboardingModal';
import type {
  SeerOnboardingActions,
  SeerOnboardingState,
} from 'sentry/components/seer/onboarding/types';

const organization = OrganizationFixture({features: ['seat-based-seer-enabled']});

function makeActions(): SeerOnboardingActions {
  return {
    activateSeer: jest.fn(),
    addRepoLink: jest.fn(),
    connectScm: jest.fn(),
    enableAiFeatures: jest.fn(),
    removeRepoLink: jest.fn(),
    setEnableSeerCoding: jest.fn(),
    setLinkProject: jest.fn(),
    setLinkRepo: jest.fn(),
    setProjectStoppingPoint: jest.fn(),
  };
}

function renderModal(
  scenarioKey: string,
  actions = makeActions(),
  stateOverrides: Partial<SeerOnboardingState> = {}
) {
  const closeModal = jest.fn();
  render(
    <SeerOnboardingModal
      Header={makeClosableHeader(closeModal)}
      Body={ModalBody}
      Footer={ModalFooter}
      CloseButton={makeCloseButton(closeModal)}
      closeModal={closeModal}
      actions={actions}
      state={{...getSeerOnboardingScenario(scenarioKey).state, ...stateOverrides}}
    />,
    {organization}
  );
  return {actions, closeModal};
}

describe('SeerOnboardingModal', () => {
  it('celebrates a fully configured organization instead of showing the wizard', () => {
    renderModal('fully-configured');

    expect(screen.getByText('Autofix is ready')).toBeInTheDocument();
    expect(screen.queryByText('Connect your source code')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
  });

  it('omits the generative AI step when it is not blocking anything', () => {
    renderModal('no-scm');

    // Generative AI is on by default, so it is not a step — connecting the SCM is.
    expect(screen.queryByText('Turn on generative AI')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect GitHub'})).toBeInTheDocument();
  });

  it('surfaces the generative AI step only when AI is actually disabled', () => {
    renderModal('gen-ai-disabled');

    expect(screen.getByText('Turn on generative AI')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Enable Generative AI Features'})
    ).toBeInTheDocument();
  });

  it('asks for the SCM connection through the provided action', async () => {
    const {actions} = renderModal('no-scm');

    await userEvent.click(screen.getByRole('button', {name: 'Connect GitHub'}));

    expect(actions.connectScm).toHaveBeenCalled();
  });

  it('renders a custom scmButton in place of the default', () => {
    const closeModal = jest.fn();
    render(
      <SeerOnboardingModal
        Header={makeClosableHeader(closeModal)}
        Body={ModalBody}
        Footer={ModalFooter}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        actions={makeActions()}
        state={getSeerOnboardingScenario('no-scm').state}
        scmButton={<button type="button">Install the real thing</button>}
      />,
      {organization}
    );

    expect(
      screen.getByRole('button', {name: 'Install the real thing'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Connect GitHub'})
    ).not.toBeInTheDocument();
  });

  it('tells a read-only member to find an admin', () => {
    renderModal('read-only-member');

    expect(
      screen.getByText(
        'You need an admin to enable generative AI features before Seer can do anything here.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Enable Generative AI Features'})
    ).not.toBeInTheDocument();
  });

  it('locks the code generation switch when the org manages it', async () => {
    renderModal('coding-managed');

    expect(await screen.findByRole('checkbox')).toBeDisabled();
    expect(
      screen.getByText('Code generation is managed by your organization.')
    ).toBeInTheDocument();
  });

  it('sets the stopping point per project, in user-facing terms', async () => {
    const {actions} = renderModal('repos-automation-off');

    // Both linked projects get their own control; change the first one.
    const selects = await screen.findAllByRole('button', {name: 'No Automation'});
    expect(selects).toHaveLength(2);

    await userEvent.click(selects[0]!);
    await userEvent.click(screen.getByRole('option', {name: 'Stop after PR drafted'}));

    expect(actions.setProjectStoppingPoint).toHaveBeenCalledWith(
      'project-1',
      'create_pr'
    );
  });

  it('lists one row per repository/project pairing', async () => {
    renderModal('half-linked');

    // One project is already linked, so the wizard opens past this step.
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    expect(screen.getByRole('button', {name: 'acme/web'})).toBeInTheDocument();
    // The half-filled row keeps its repo but still prompts for a project.
    expect(
      screen.getByRole('button', {name: 'acme/checkout-service'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Select a project'})).toBeInTheDocument();
  });

  it('starts a new repository row', async () => {
    const {actions} = renderModal('scm-no-repos');

    await userEvent.click(screen.getByRole('button', {name: 'Connect a repository'}));

    expect(actions.addRepoLink).toHaveBeenCalled();
  });

  it('removes a repository row', async () => {
    const {actions} = renderModal('half-linked');
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove repository'})[0]!);

    expect(actions.removeRepoLink).toHaveBeenCalledWith('link-1');
  });

  it('picks a repository and a project for a row', async () => {
    const {actions} = renderModal('scm-no-repos', undefined, {
      repoLinks: [{id: 'link-x', repoId: '', projectId: ''}],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Select a repository'}));
    await userEvent.click(screen.getByRole('option', {name: 'acme/api'}));
    expect(actions.setLinkRepo).toHaveBeenCalledWith('link-x', 'repo-2');

    await userEvent.click(screen.getByRole('button', {name: 'Select a project'}));
    await userEvent.click(screen.getByRole('option', {name: 'backend'}));
    expect(actions.setLinkProject).toHaveBeenCalledWith('link-x', 'project-2');
  });

  it('has nothing to automate until a repository is linked', async () => {
    renderModal('scm-no-repos');

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(
      screen.getByText(
        'Link a repository to a project first — there is nothing to automate yet.'
      )
    ).toBeInTheDocument();
  });

  it('replaces the wizard with a named blocker for a genuine setup problem', () => {
    renderModal('no-scm-write-access');

    expect(screen.getByText('Missing repository write access')).toBeInTheDocument();
    expect(screen.queryByText('Connect your source code')).not.toBeInTheDocument();
  });

  it('starts a brand new org on the first real step, with nothing done', () => {
    renderModal('brand-new');

    expect(screen.queryByText('Turn on generative AI')).not.toBeInTheDocument();
    expect(screen.getByText('Connect your source code')).toBeInTheDocument();
    expect(screen.getByText('Let Seer open pull requests')).toBeInTheDocument();
    // Step one is open and actionable, not pre-ticked.
    expect(screen.getByRole('button', {name: 'Connect GitHub'})).toBeInTheDocument();
  });

  it('explains why nothing is running yet for an org without Seer', async () => {
    const {actions} = renderModal('brand-new');

    expect(
      screen.getByText(
        'Seer is not on this plan yet. You can still set everything up now — Autofix will start running as soon as Seer is added.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add Seer'}));
    expect(actions.activateSeer).toHaveBeenCalled();
  });

  it('tells an org that finished setup without paying that Autofix is waiting', async () => {
    const {actions} = renderModal('unpaid-configured');

    expect(screen.getByText('Autofix is ready and waiting')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add Seer to your plan'}));
    expect(actions.activateSeer).toHaveBeenCalled();
  });

  it('offers budget rather than a plan when the org already pays for Seer', () => {
    renderModal('no-budget');

    expect(screen.getByText('Autofix is ready and waiting')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Seer budget'})).toBeInTheDocument();
  });

  it('jumps straight to a step from any row', async () => {
    renderModal('half-linked');

    // Opens on the last step, since the earlier ones are satisfied.
    expect(screen.getByRole('button', {name: 'No Automation'})).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Go to “Connect your source code”'})
    );

    expect(screen.getByRole('button', {name: 'Connect GitHub'})).toBeInTheDocument();

    // ...and back down again, without walking through the step between.
    await userEvent.click(
      screen.getByRole('button', {name: 'Go to “Let Seer open pull requests”'})
    );
    expect(screen.getByRole('button', {name: 'No Automation'})).toBeInTheDocument();
  });

  it('points every step at the setting that owns it', async () => {
    renderModal('gen-ai-disabled');

    // Step 1 — generative AI lives on organization general settings.
    expect(
      screen.getByRole('link', {name: 'Show Generative AI Features'})
    ).toHaveAttribute('href', '/settings/org-slug/#hideAiFeatures');

    // Step 2 — the integration itself.
    await userEvent.click(
      screen.getByRole('button', {name: 'Go to “Connect your source code”'})
    );
    expect(screen.getByRole('link', {name: 'Integrations'})).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/'
    );

    // Step 3 — repository wiring.
    await userEvent.click(
      screen.getByRole('button', {name: 'Go to “Link a repository to a project”'})
    );
    expect(screen.getByRole('link', {name: 'Autofix settings'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/projects/'
    );

    // Step 4 — automation and code generation are two different pages.
    await userEvent.click(
      screen.getByRole('button', {name: 'Go to “Let Seer open pull requests”'})
    );
    expect(screen.getByRole('link', {name: 'Autofix settings'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/projects/'
    );
    expect(screen.getByRole('link', {name: 'Defaults'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/projects/defaults/'
    );
    expect(screen.getByRole('link', {name: 'Advanced settings'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/advanced/#enableSeerCoding'
    );
  });

  it('points the finished state back at Seer settings', () => {
    renderModal('fully-configured');

    expect(screen.getByRole('link', {name: 'Seer settings'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/projects/'
    );
  });
});
