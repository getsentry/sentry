import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/button';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {
  type AutofixChangesStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';

jest.mock('sentry/components/button', () => ({
  Button: jest.fn(props => {
    // Forward the click handler while allowing us to inspect props
    return <button onClick={props.onClick}>{props.children}</button>;
  }),
  LinkButton: jest.fn(props => {
    return <a href={props.href}>{props.children}</a>;
  }),
}));

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
  });

  it('passes correct analytics props for Create PR button when write access is enabled', async () => {
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

  it('passes correct analytics props for Add Tests button', () => {
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

    render(<AutofixChanges {...defaultProps} />);
    screen.getByText('Add Tests').click();

    const addTestsButtonCall = mockButton.mock.calls.find(
      call => call[0]?.analyticsEventKey === 'autofix.add_tests_clicked'
    );
    expect(addTestsButtonCall?.[0]).toEqual(
      expect.objectContaining({
        analyticsEventKey: 'autofix.add_tests_clicked',
        analyticsEventName: 'Autofix: Add Tests Clicked',
        analyticsParams: {group_id: '123'},
      })
    );
  });
});
