import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import type {
  AutofixSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

import {SeerDrawerNextStep} from './nextStep';

jest.mock('sentry/utils/analytics');

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  const base: ReturnType<typeof useExplorerAutofix> = {
    runState: {run_id: 1} as any,
    startStep: jest.fn(),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    isLoading: false,
    isPolling: false,
  };
  return {...base, ...overrides};
}

function defaultArtifacts(step: string): AutofixSection['artifacts'] {
  switch (step) {
    case 'root_cause':
      return [
        {
          key: 'root_cause',
          reason: 'test',
          data: {one_line_description: 'desc', five_whys: ['why']},
        },
      ];
    case 'solution':
      return [
        {
          key: 'solution',
          reason: 'test',
          data: {one_line_summary: 'summary', steps: [{title: 't', description: 'd'}]},
        },
      ];
    case 'code_changes': {
      const codeChange: ExplorerFilePatch = {
        repo_name: 'repo',
        diff: 'diff content',
        patch: {
          added: 1,
          removed: 0,
          path: 'file.py',
          source_file: 'file.py',
          target_file: 'file.py',
          type: DiffFileType.MODIFIED,
          hunks: [
            {
              section_header: '@@ -1,1 +1,2 @@',
              source_start: 1,
              source_length: 1,
              target_start: 1,
              target_length: 2,
              lines: [
                {
                  diff_line_no: 1,
                  line_type: DiffLineType.ADDED,
                  source_line_no: null,
                  target_line_no: 1,
                  value: 'new line',
                },
              ],
            },
          ],
        },
      };
      return [[codeChange]];
    }
    default:
      return [];
  }
}

function makeSection(
  step: string,
  artifacts?: AutofixSection['artifacts']
): AutofixSection {
  return {
    step,
    artifacts: artifacts ?? defaultArtifacts(step),
    blocks: [],
    status: 'completed',
  };
}

describe('SeerDrawerNextStep', () => {
  it('returns null when no runId', () => {
    const autofix = makeAutofix({runState: null});
    const {container} = render(
      <SeerDrawerNextStep group={GroupFixture()} sections={[]} autofix={autofix} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when sections are empty', () => {
    const autofix = makeAutofix();
    const {container} = render(
      <SeerDrawerNextStep group={GroupFixture()} sections={[]} autofix={autofix} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null while polling', () => {
    const autofix = makeAutofix({isPolling: true});
    const {container} = render(
      <SeerDrawerNextStep
        group={GroupFixture()}
        sections={[makeSection('root_cause')]}
        autofix={autofix}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe('RootCauseNextStep', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {integrations: []},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [{provider: 'github'}],
      });
    });

    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      expect(screen.getByText('Are you happy with this root cause?')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Yes, make a plan'})).toBeInTheDocument();
    });

    it('calls startStep with solution on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, make a plan'}));
      expect(autofix.startStep).toHaveBeenCalledWith('solution', {runId: 1});
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rethink root cause'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, make a plan'})
      ).toBeInTheDocument();
    });

    it('calls startStep with root_cause and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Try a different approach');
      await userEvent.click(screen.getByRole('button', {name: 'Rethink root cause'}));
      expect(autofix.startStep).toHaveBeenCalledWith('root_cause', {
        runId: 1,
        userContext: 'Try a different approach',
      });
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.click(screen.getByRole('button', {name: 'Nevermind, make a plan'}));
      expect(autofix.startStep).toHaveBeenCalledWith('solution', {runId: 1});
    });

    it('shows coding agent dropdown with Add Integration CTA when no integrations exist', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(
        await screen.findByRole('button', {name: 'More code fix options'})
      );
      const addIntegrationLink = screen.getByRole('button', {name: 'Add Integration'});
      expect(addIntegrationLink).toHaveAttribute(
        'href',
        '/settings/org-slug/integrations/?category=coding%20agent'
      );
    });

    it('shows coding agent dropdown when integrations exist', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      expect(
        await screen.findByRole('button', {name: 'More code fix options'})
      ).toBeInTheDocument();
    });

    it('shows Add Integration link in dropdown footer', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      await userEvent.click(
        await screen.findByRole('button', {name: 'More code fix options'})
      );
      const addIntegrationLink = screen.getByRole('button', {name: 'Add Integration'});
      expect(addIntegrationLink).toHaveAttribute(
        'href',
        '/settings/org-slug/integrations/?category=coding%20agent'
      );
    });

    it('disables the coding agent dropdown when the project only has GitLab repos', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Claude', provider: 'claude_code', requires_identity: false},
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [{provider: 'gitlab'}],
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      // The dropdown is still rendered, but disabled with an explanatory tooltip.
      const dropdownButton = await screen.findByRole('button', {
        name: 'More code fix options',
      });
      expect(dropdownButton).toBeDisabled();
      await userEvent.hover(dropdownButton);
      expect(
        await screen.findByText(/requires a connected GitHub repository/)
      ).toBeInTheDocument();
    });

    it('disables the coding agent dropdown with repo-connect copy when the project has no repos', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Claude', provider: 'claude_code', requires_identity: false},
          ],
        },
      });
      // No repos connected: the backend can't launch a handoff, so disable the dropdown
      // with copy pointing at the actual gap — a connected GitHub repository.
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [],
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );
      const dropdownButton = await screen.findByRole('button', {
        name: 'More code fix options',
      });
      expect(dropdownButton).toBeDisabled();
      await userEvent.hover(dropdownButton);
      expect(
        await screen.findByText(
          'Connect a GitHub repository to hand off to a coding agent.'
        )
      ).toBeInTheDocument();
    });

    it('does not expose the coding agent dropdown until every repo page has loaded', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Claude', provider: 'claude_code', requires_identity: false},
          ],
        },
      });
      // Page 1 is GitHub-only and advertises another page via the Link header. Gating on
      // the first page alone would briefly expose the dropdown enabled, before the GitLab
      // repo on page 2 (which makes the project non-GitHub-only) has loaded.
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [{provider: 'github'}],
        headers: {
          Link:
            '<https://sentry.io>; rel="previous"; results="false"; cursor="0:0:1", ' +
            '<https://sentry.io>; rel="next"; results="true"; cursor="0:20:0"',
        },
      });
      // Page 2 stays in flight (large delay) so we can observe the mid-pagination state:
      // page 1 has resolved, but the full repo list is not yet known.
      const page2Request = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [{provider: 'gitlab'}],
        match: [MockApiClient.matchQuery({cursor: '0:20:0'})],
        asyncDelay: 100_000,
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('root_cause')]}
          autofix={autofix}
        />
      );

      // Page 2 is only requested once page 1 resolves and `useFetchAllPages` advances,
      // so this confirms page 1 (GitHub-only) has loaded.
      await waitFor(() => expect(page2Request).toHaveBeenCalled());

      // While page 2 is still loading the dropdown must remain hidden, so it can never
      // render briefly enabled from the partial (GitHub-only) page-1 repo list.
      expect(
        screen.queryByRole('button', {name: 'More code fix options'})
      ).not.toBeInTheDocument();
    });
  });

  describe('SolutionNextStep', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {integrations: []},
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/seer/repos/',
        body: [{provider: 'github'}],
      });
    });
    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      expect(screen.getByText('Are you happy with this plan?')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Yes, write a code fix'})
      ).toBeInTheDocument();
    });

    it('calls startStep with code_changes on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'Yes, write a code fix'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', {runId: 1});
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Rethink plan'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, write a code fix'})
      ).toBeInTheDocument();
    });

    it('calls startStep with solution and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Consider edge cases');
      await userEvent.click(screen.getByRole('button', {name: 'Rethink plan'}));
      expect(autofix.startStep).toHaveBeenCalledWith('solution', {
        runId: 1,
        userContext: 'Consider edge cases',
      });
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('solution')]}
          autofix={autofix}
        />
      );
      await userEvent.click(screen.getByRole('button', {name: 'No'}));
      await userEvent.click(
        screen.getByRole('button', {name: 'Nevermind, write a code fix'})
      );
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', {runId: 1});
    });
  });

  describe('CodeChangesNextStep', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/autofix/repos/',
        body: {repos: [{has_write_access: true}]},
      });
    });

    it('returns null when section has no artifacts', () => {
      const autofix = makeAutofix();
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes', [])]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders prompt and yes button', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      expect(
        await screen.findByText('Are you happy with these code changes?')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'No'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Yes, draft a PR'})).toBeInTheDocument();
    });

    it('calls createPR on yes click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(await screen.findByRole('button', {name: 'Yes, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('shows feedback UI on no click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(await screen.findByRole('button', {name: 'No'}));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Rethink code changes'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Nevermind, draft a PR'})
      ).toBeInTheDocument();
    });

    it('calls startStep with code_changes and feedback on rethink click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(await screen.findByRole('button', {name: 'No'}));
      await userEvent.type(screen.getByRole('textbox'), 'Fix the error handling');
      await userEvent.click(screen.getByRole('button', {name: 'Rethink code changes'}));
      expect(autofix.startStep).toHaveBeenCalledWith('code_changes', {
        runId: 1,
        userContext: 'Fix the error handling',
      });
    });

    it('proceeds like yes on nevermind click', async () => {
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await userEvent.click(await screen.findByRole('button', {name: 'No'}));
      await userEvent.click(screen.getByRole('button', {name: 'Nevermind, draft a PR'}));
      expect(autofix.createPR).toHaveBeenCalledWith(1);
    });

    it('does not show coding agent dropdown', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/integrations/coding-agents/',
        body: {
          integrations: [
            {id: '1', name: 'Copilot', provider: 'github', requires_identity: false},
          ],
        },
      });
      const autofix = makeAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('code_changes')]}
          autofix={autofix}
        />
      );
      await screen.findByText('Are you happy with these code changes?');
      expect(
        screen.queryByRole('button', {name: 'More code fix options'})
      ).not.toBeInTheDocument();
    });
  });

  describe('PullRequestNextStep', () => {
    const prIterationOrganization = OrganizationFixture({
      features: ['autofix-pr-iteration'],
    });

    function makePrIterationAutofix(
      overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
    ) {
      return makeAutofix({
        runState: {run_id: 1, blocks: []} as any,
        ...overrides,
      });
    }

    beforeEach(() => {
      jest.mocked(trackAnalytics).mockClear();
    });

    it('returns null when the run is not valid for PR iteration', () => {
      const autofix = makeAutofix({
        runState: {run_id: 1, blocks: []} as any,
      });
      const {container} = render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('pull_request')]}
          autofix={autofix}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('keeps the feedback form visible while a run is polling', () => {
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('pull_request')]}
          autofix={makePrIterationAutofix({isPolling: true})}
        />,
        {organization: prIterationOrganization}
      );
      expect(
        screen.getByText('Anything else you want to see on your PR?')
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders the feedback prompt, textarea, and submit button', () => {
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('pull_request')]}
          autofix={makePrIterationAutofix()}
        />,
        {organization: prIterationOrganization}
      );
      expect(
        screen.getByText('Anything else you want to see on your PR?')
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Submit'})).toBeDisabled();
    });

    it('submits feedback via startStep and tracks analytics', async () => {
      const autofix = makePrIterationAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture({id: '123'})}
          sections={[makeSection('pull_request')]}
          autofix={autofix}
        />,
        {organization: prIterationOrganization}
      );

      await userEvent.type(screen.getByRole('textbox'), 'Add a test for this');
      await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

      expect(autofix.startStep).toHaveBeenCalledWith('pr_iteration', {
        runId: 1,
        userContext: 'Add a test for this',
      });
      expect(trackAnalytics).toHaveBeenCalledWith(
        'autofix.pr_iteration.feedback',
        expect.objectContaining({group_id: '123', mode: 'explorer'})
      );
    });

    it('submits on Enter but not on Shift+Enter', async () => {
      const autofix = makePrIterationAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('pull_request')]}
          autofix={autofix}
        />,
        {organization: prIterationOrganization}
      );

      const textbox = screen.getByRole('textbox');
      await userEvent.type(textbox, 'first line{Shift>}{Enter}{/Shift}');
      expect(autofix.startStep).not.toHaveBeenCalled();

      await userEvent.type(textbox, '{Enter}');
      expect(autofix.startStep).toHaveBeenCalledWith(
        'pr_iteration',
        expect.objectContaining({userContext: expect.stringContaining('first line')})
      );
    });

    it('does not submit when feedback is empty', async () => {
      const autofix = makePrIterationAutofix();
      render(
        <SeerDrawerNextStep
          group={GroupFixture()}
          sections={[makeSection('pull_request')]}
          autofix={autofix}
        />,
        {organization: prIterationOrganization}
      );

      await userEvent.type(screen.getByRole('textbox'), '{Enter}');
      expect(autofix.startStep).not.toHaveBeenCalled();
    });
  });
});
