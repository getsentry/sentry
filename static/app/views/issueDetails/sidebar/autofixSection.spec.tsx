import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiffFileType} from 'sentry/components/events/autofix/types';
import {IssueCategory, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {
  LLMContextProvider,
  useLLMContext,
} from 'sentry/views/seerExplorer/contexts/llmContext';
import type {LLMContextSnapshot} from 'sentry/views/seerExplorer/contexts/llmContextTypes';

import {AutofixSection} from './autofixSection';

jest.mock('sentry/utils/cells');

describe('AutofixSection', () => {
  const mockProject = DetailedProjectFixture();
  const organization = OrganizationFixture({
    hideAiFeatures: false,
    features: ['gen-ai-features'],
  });

  let mockGroup: ReturnType<typeof GroupFixture>;

  beforeEach(() => {
    mockGroup = GroupFixture();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        seerReposLinked: true,
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });
  });

  it('renders Seer section title when AI features are enabled', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/summarize/`,
      method: 'POST',
      body: {whatsWrong: 'Something broke', possibleCause: 'Bad code'},
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(screen.getByText('Seer Autofix')).toBeInTheDocument();
  });

  it('renders Resources section when AI features are disabled', () => {
    const customOrganization = OrganizationFixture({
      hideAiFeatures: true,
      features: ['gen-ai-features'],
    });

    const performanceGroup: Group = {
      ...mockGroup,
      issueCategory: IssueCategory.PERFORMANCE,
      title: 'ChunkLoadError',
      platform: 'javascript',
    };

    const javascriptProject: Project = {
      ...mockProject,
      platform: 'javascript',
    };

    render(<AutofixSection group={performanceGroup} project={javascriptProject} />, {
      organization: customOrganization,
    });

    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('returns null when AI features are disabled and no resources exist', () => {
    const customOrganization = OrganizationFixture({
      hideAiFeatures: true,
      features: ['gen-ai-features'],
    });

    const {container} = render(
      <AutofixSection group={mockGroup} project={mockProject} />,
      {organization: customOrganization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders root cause artifact when autofix returns root cause', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Found root cause',
                role: 'assistant',
                metadata: {step: 'root_cause'},
              },
              timestamp: new Date().toISOString(),
              artifacts: [
                {
                  key: 'root_cause',
                  reason: 'Identified the issue',
                  data: {
                    one_line_description: 'Null pointer in user handler',
                    five_whys: ['why1'],
                    reproduction_steps: ['step1'],
                  },
                },
              ],
            },
          ],
        },
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Null pointer in user handler')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });

  it('renders solution artifact', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Found solution',
                role: 'assistant',
                metadata: {step: 'solution'},
              },
              timestamp: new Date().toISOString(),
              artifacts: [
                {
                  key: 'solution',
                  reason: 'Proposed a fix',
                  data: {
                    one_line_summary: 'Add null check before accessing user',
                    steps: [{title: 'Step 1', description: 'Add guard clause'}],
                  },
                },
              ],
            },
          ],
        },
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Add null check before accessing user')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });

  it('renders code changes preview from merged file patches', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Made changes',
                role: 'assistant',
                metadata: {step: 'code_changes'},
              },
              timestamp: new Date().toISOString(),
              merged_file_patches: [
                {
                  diff: '',
                  repo_name: 'org/repo',
                  patch: {
                    path: 'src/app.py',
                    added: 5,
                    removed: 2,
                    hunks: [],
                    source_file: 'src/app.py',
                    target_file: 'src/app.py',
                    type: DiffFileType.MODIFIED,
                  },
                },
                {
                  diff: '',
                  repo_name: 'org/repo',
                  patch: {
                    path: 'src/utils.py',
                    added: 3,
                    removed: 0,
                    hunks: [],
                    source_file: 'src/utils.py',
                    target_file: 'src/utils.py',
                    type: DiffFileType.MODIFIED,
                  },
                },
              ],
            },
          ],
        },
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByText('2 files changed in 1 repo')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });

  it('renders pull request previews from repo_pr_states', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Created PR',
                role: 'assistant',
                metadata: {step: 'code_changes'},
              },
              timestamp: new Date().toISOString(),
              merged_file_patches: [
                {
                  repo_name: 'org/repo',
                  patch: {
                    path: 'src/app.py',
                    added: 1,
                    removed: 0,
                    hunks: [],
                    source_file: 'src/app.py',
                    target_file: 'src/app.py',
                    type: DiffFileType.MODIFIED,
                  },
                },
              ],
            },
          ],
          repo_pr_states: {
            'org/repo': {
              repo_name: 'org/repo',
              pr_number: 42,
              pr_url: 'https://github.com/org/repo/pull/42',
              branch_name: 'fix/issue',
              commit_sha: 'abc123',
              pr_creation_error: null,
              pr_creation_status: 'completed',
              pr_id: 1,
              title: 'Fix null pointer',
            },
          },
        },
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Pull Requests')).toBeInTheDocument();
    const link = screen.getByRole('link', {name: 'org/repo#42'});
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');
    expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });

  it('shows empty state when autofix returns null', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
      statusCode: 200,
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    // The Seer title should still render
    expect(screen.getByText('Seer Autofix')).toBeInTheDocument();
    expect(await screen.findByText('Have Seer...')).toBeInTheDocument();
  });

  it('renders multiple artifact types in order', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Found root cause',
                role: 'assistant',
                metadata: {step: 'root_cause'},
              },
              timestamp: new Date().toISOString(),
              artifacts: [
                {
                  key: 'root_cause',
                  reason: 'Found root cause',
                  data: {
                    one_line_description: 'Missing null check',
                    five_whys: ['why'],
                    reproduction_steps: ['step'],
                  },
                },
              ],
            },
            {
              id: 'block-2',
              message: {
                content: 'Proposed fix',
                role: 'assistant',
                metadata: {step: 'solution'},
              },
              timestamp: new Date().toISOString(),
              artifacts: [
                {
                  key: 'solution',
                  reason: 'Proposed fix',
                  data: {
                    one_line_summary: 'Add validation',
                    steps: [{title: 'Validate', description: 'Add check'}],
                  },
                },
              ],
            },
            {
              id: 'block-3',
              message: {
                content: 'Made code changes',
                role: 'assistant',
                metadata: {step: 'code_changes'},
              },
              timestamp: new Date().toISOString(),
              merged_file_patches: [
                {
                  diff: '',
                  repo_name: 'org/repo',
                  patch: {
                    path: 'src/handler.py',
                    added: 2,
                    removed: 1,
                    hunks: [],
                    source_file: 'src/handler.py',
                    target_file: 'src/handler.py',
                    type: DiffFileType.MODIFIED,
                  },
                },
              ],
            },
          ],
        },
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Root Cause')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Code Changes')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Autofix'})).toBeInTheDocument();
  });

  it('shows org setup UI when SCM integration is missing', async () => {
    const seatBasedOrg = OrganizationFixture({
      hideAiFeatures: false,
      features: ['gen-ai-features', 'seat-based-seer-enabled'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${seatBasedOrg.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: false,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization: seatBasedOrg,
    });

    expect(await screen.findByText('Finish Configuring Seer')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'Set Up Seer'});
    expect(link).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/seer/onboarding/`
    );
  });

  it('shows project setup UI when repos are not linked', async () => {
    const seatBasedOrg = OrganizationFixture({
      hideAiFeatures: false,
      features: ['gen-ai-features', 'seat-based-seer-enabled'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/setup/`,
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        seerReposLinked: false,
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization: seatBasedOrg,
    });

    expect(await screen.findByText('Finish Configuring Seer')).toBeInTheDocument();
    const link = screen.getByRole('button', {
      name: 'Set Up Seer for This Project',
    });
    expect(link).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/projects/${mockProject.slug}/seer/`
    );
  });

  it('skips setup UI for legacy seer plan orgs without SCM integration', async () => {
    const legacyOrg = OrganizationFixture({
      hideAiFeatures: false,
      features: ['gen-ai-features', 'seer-added'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${legacyOrg.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: false,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {autofix: null},
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization: legacyOrg,
    });

    expect(await screen.findByText('Have Seer...')).toBeInTheDocument();
    expect(screen.queryByText('Finish Configuring Seer')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no artifacts', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: null,
      },
    });

    render(<AutofixSection group={mockGroup} project={mockProject} />, {
      organization,
    });

    expect(await screen.findByText('Have Seer...')).toBeInTheDocument();
    expect(
      screen.getByText('Determine the root cause of your issue')
    ).toBeInTheDocument();
    expect(screen.getByText('Outline a plan')).toBeInTheDocument();
    expect(screen.getByText('Create a code fix')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Start Analysis'})).toBeInTheDocument();
  });

  it('pushes autofix data into LLM context when results are available', async () => {
    const snapshotRef: {current: (() => LLMContextSnapshot) | null} = {current: null};

    function ContextCapture() {
      const {getLLMContext} = useLLMContext();
      snapshotRef.current = getLLMContext;
      return null;
    }

    MockApiClient.addMockResponse({
      url: `/organizations/${mockProject.organization.slug}/issues/${mockGroup.id}/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: new Date().toISOString(),
          blocks: [
            {
              id: 'block-1',
              message: {
                content: 'Found root cause',
                role: 'assistant',
                metadata: {step: 'root_cause'},
              },
              timestamp: new Date().toISOString(),
              artifacts: [
                {
                  key: 'root_cause',
                  reason: 'Identified the issue',
                  data: {
                    one_line_description: 'Null pointer in user handler',
                    five_whys: ['Missing guard clause'],
                    reproduction_steps: ['Call /api/user with null id'],
                  },
                },
              ],
            },
            {
              id: 'block-2',
              message: {
                content: 'Made code changes',
                role: 'assistant',
                metadata: {step: 'code_changes'},
              },
              timestamp: new Date().toISOString(),
              merged_file_patches: [
                {
                  diff: '--- a/src/handler.py\n+++ b/src/handler.py',
                  repo_name: 'org/repo',
                  patch: {
                    path: 'src/handler.py',
                    added: 2,
                    removed: 1,
                    hunks: [],
                    source_file: 'src/handler.py',
                    target_file: 'src/handler.py',
                    type: DiffFileType.MODIFIED,
                  },
                },
              ],
            },
          ],
        },
      },
    });

    render(
      <LLMContextProvider>
        <AutofixSection group={mockGroup} project={mockProject} />
        <ContextCapture />
      </LLMContextProvider>,
      {organization}
    );

    await waitFor(() => {
      const node = snapshotRef.current?.().nodes.find(n => n.nodeType === 'autofix');
      expect((node?.data as Record<string, string> | undefined)?.autofixStatus).toBe(
        'completed'
      );
    });

    const data = snapshotRef.current!().nodes.find(n => n.nodeType === 'autofix')!
      .data as Record<string, string>;
    expect(data.rootCause).toContain('Null pointer in user handler');
    expect(data.codeChanges).toBe('org/repo: src/handler.py');
  });
});
