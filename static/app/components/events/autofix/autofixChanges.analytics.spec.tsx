import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {
  AutofixStatus,
  AutofixStepType,
  type AutofixChangesStep,
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
  ButtonBar: jest.fn(props => {
    return <div {...props}>{props.children}</div>;
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
  } satisfies React.ComponentProps<typeof AutofixChanges>;

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
        last_triggered_at: '2024-01-01T00:00:00Z',
        run_id: '456',
        status: AutofixStatus.COMPLETED,
      },
      isPending: false,
    });
  });

  it('passes correct analytics props for Create PR button when write access is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {ok: true, repos: []},
      }),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/autofix/update/',
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
      url: '/organizations/org-slug/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: true,
          repos: [{ok: false, owner: 'owner', name: 'hello-world', provider: 'github'}],
        },
      }),
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
      url: '/organizations/org-slug/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: true,
          repos: [{ok: true, owner: 'owner', name: 'hello-world', provider: 'github'}],
        },
      }),
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/123/autofix/update/',
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
      url: '/organizations/org-slug/issues/123/autofix/setup/?check_write_access=true',
      method: 'GET',
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: true,
          repos: [{ok: false, owner: 'owner', name: 'hello-world', provider: 'github'}],
        },
      }),
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
