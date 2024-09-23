import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {
  type AutofixChangesStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';

describe('AutofixChanges', function () {
  const defaultProps = {
    groupId: '1',
    onRetry: jest.fn(),
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      changes: [AutofixCodebaseChangeData()],
    }) as AutofixChangesStep,
  };

  it('displays link to PR when one exists', function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        codebaseIndexing: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    render(<AutofixChanges {...defaultProps} />);

    expect(
      screen.queryByRole('button', {name: 'Create a Pull Request'})
    ).not.toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'View Pull Request'})).toHaveAttribute(
      'href',
      'https://github.com/owner/hello-world/pull/200'
    );
  });

  it('displays create PR button', function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        codebaseIndexing: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    render(
      <AutofixChanges
        {...defaultProps}
        step={
          AutofixStepFixture({
            type: AutofixStepType.CHANGES,
            changes: [
              AutofixCodebaseChangeData({
                pull_request: undefined,
              }),
            ],
          }) as AutofixChangesStep
        }
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Create a Pull Request'})
    ).toBeInTheDocument();
  });

  it('displays setup button when permissions do not exist for repo', async function () {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        codebaseIndexing: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [
            {ok: false, provider: 'github', owner: 'owner', name: 'hello-world', id: 100},
          ],
        },
      },
    });

    render(
      <AutofixChanges
        {...defaultProps}
        step={
          AutofixStepFixture({
            type: AutofixStepType.CHANGES,
            changes: [
              AutofixCodebaseChangeData({
                pull_request: undefined,
              }),
            ],
          }) as AutofixChangesStep
        }
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Create a Pull Request'}));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Allow Autofix to Make Pull Requests')
    ).toBeInTheDocument();
  });
});
