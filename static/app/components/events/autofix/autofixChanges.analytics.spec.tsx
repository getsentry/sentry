import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/core/button';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {
  type AutofixChangesStep,
  AutofixStatus,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {
  useAutofixData,
  useAutofixRepos,
} from 'sentry/components/events/autofix/useAutofix';

jest.mock('sentry/components/core/button', () => ({
  Button: jest.fn(props => {
    // Forward the click handler while allowing us to inspect props
    return <button onClick={props.onClick}>{props.children}</button>;
  }),
  LinkButton: jest.fn(props => {
    return <a href={props.href}>{props.children}</a>;
  }),
}));

jest.mock('sentry/components/events/autofix/useAutofix');

const mockButton = Button as jest.MockedFunction<typeof Button>;

describe('AutofixChanges', () => {
  const defaultProps = {
    groupId: '123',
    runId: '456',
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      changes: [AutofixCodebaseChangeData()],
    }) as AutofixChangesStep,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockButton.mockClear();
    jest.mocked(useAutofixRepos).mockReset();
    jest.mocked(useAutofixData).mockReset();
    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [],
      codebases: {},
    });
    jest.mocked(useAutofixData).mockReturnValue({
      data: {
        request: {
          repos: [],
        },
        codebases: {},
        created_at: '2024-01-01T00:00:00Z',
        run_id: '456',
        status: AutofixStatus.COMPLETED,
      },
      isPending: false,
    });
  });

  it('passes correct analytics props for Create PR button when write access is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {},
      },
    });

    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
      body: {ok: true},
    });

    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [
        {
          name: 'org/repo',
          owner: 'org',
          provider: 'github',
          provider_raw: 'github',
          external_id: '100',
          is_readable: true,
          is_writeable: true,
        },
      ],
      codebases: {
        '100': {
          repo_external_id: '100',
          is_readable: true,
          is_writeable: true,
        },
      },
    });

    render(<AutofixChanges {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', {name: 'Draft PR'}));

    const createPRButtonCall = mockButton.mock.calls.find(
      call => call[0]?.analyticsEventKey === 'autofix.create_pr_clicked'
    );
    expect(createPRButtonCall?.[0]).toEqual(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_pr_clicked',
        analyticsEventName: 'Autofix: Create PR Clicked',
        analyticsParams: {group_id: '123'},
      })
    );
  });

  it('passes correct analytics props for Create PR Setup button when write access is not enabled', () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: false, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [
        {
          name: 'org/repo',
          owner: 'org',
          provider: 'github',
          provider_raw: 'github',
          external_id: 'repo-123',
          is_readable: true,
          is_writeable: false,
        },
      ],
      codebases: {
        'repo-123': {
          repo_external_id: 'repo-123',
          is_readable: true,
          is_writeable: false,
        },
      },
    });

    render(<AutofixChanges {...defaultProps} />);

    // Find the last call to Button that matches our Setup button
    const setupButtonCall = mockButton.mock.calls.find(
      call => call[0].children === 'Draft PR'
    );
    expect(setupButtonCall?.[0]).toEqual(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_pr_setup_clicked',
        analyticsEventName: 'Autofix: Create PR Setup Clicked',
        analyticsParams: {
          group_id: '123',
        },
      })
    );
  });

  it('passes correct analytics props for Create Branch button when write access is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
      body: {ok: true},
    });

    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [
        {
          name: 'org/repo',
          owner: 'org',
          provider: 'github',
          provider_raw: 'github',
          external_id: '100',
          is_readable: true,
          is_writeable: true,
        },
      ],
      codebases: {
        '100': {
          repo_external_id: '100',
          is_readable: true,
          is_writeable: true,
        },
      },
    });

    render(<AutofixChanges {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Check Out Locally'}));

    const createBranchButtonCall = mockButton.mock.calls.find(
      call => call[0]?.analyticsEventKey === 'autofix.push_to_branch_clicked'
    );
    expect(createBranchButtonCall?.[0]).toEqual(
      expect.objectContaining({
        analyticsEventKey: 'autofix.push_to_branch_clicked',
        analyticsEventName: 'Autofix: Push to Branch Clicked',
        analyticsParams: {group_id: '123'},
      })
    );
  });

  it('passes correct analytics props for Create Branch Setup button when write access is not enabled', () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: false, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    jest.mocked(useAutofixRepos).mockReturnValue({
      repos: [
        {
          name: 'org/repo',
          owner: 'org',
          provider: 'github',
          provider_raw: 'github',
          external_id: 'repo-123',
          is_readable: true,
          is_writeable: false,
        },
      ],
      codebases: {
        'repo-123': {
          repo_external_id: 'repo-123',
          is_readable: true,
          is_writeable: false,
        },
      },
    });

    render(<AutofixChanges {...defaultProps} />);

    const setupButtonCall = mockButton.mock.calls.find(
      call => call[0].children === 'Check Out Locally'
    );
    expect(setupButtonCall?.[0]).toEqual(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_branch_setup_clicked',
        analyticsEventName: 'Autofix: Create Branch Setup Clicked',
        analyticsParams: {
          group_id: '123',
        },
      })
    );
  });
});
