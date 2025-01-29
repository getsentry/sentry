import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/button';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';
import {AutofixStepType} from 'sentry/components/events/autofix/types';

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

describe('AutofixMessageBox Analytics', () => {
  const defaultProps = {
    displayText: 'Test display text',
    groupId: '123',
    runId: '456',
    actionText: 'Send',
    allowEmptyMessage: false,
    responseRequired: false,
    step: null,
    onSend: null,
  };

  const changesStepProps = {
    ...defaultProps,
    isChangesStep: true,
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      changes: [AutofixCodebaseChangeData()],
    }),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockButton.mockClear();
  });

  it('passes correct analytics props for suggested root cause without instructions', async () => {
    const onSendMock = jest.fn();
    render(
      <AutofixMessageBox {...defaultProps} onSend={onSendMock} isRootCauseSelectionStep />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Use suggested root cause'}));

    expect(mockButton).toHaveBeenLastCalledWith(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_fix_clicked',
        analyticsEventName: 'Autofix: Create Fix Clicked',
        analyticsParams: {
          group_id: '123',
          type: 'suggested',
        },
      }),
      expect.anything()
    );
  });

  it('passes correct analytics props for suggested root cause with instructions', async () => {
    const onSendMock = jest.fn();
    render(
      <AutofixMessageBox {...defaultProps} onSend={onSendMock} isRootCauseSelectionStep />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Use suggested root cause'}));

    const input = screen.getByPlaceholderText(
      '(Optional) Provide any instructions for the fix...'
    );
    await userEvent.type(input, 'Some instructions');

    expect(mockButton).toHaveBeenLastCalledWith(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_fix_clicked',
        analyticsEventName: 'Autofix: Create Fix Clicked',
        analyticsParams: {
          group_id: '123',
          type: 'suggested_with_instructions',
        },
      }),
      expect.anything()
    );
  });

  it('passes correct analytics props for custom root cause', async () => {
    const onSendMock = jest.fn();
    render(
      <AutofixMessageBox {...defaultProps} onSend={onSendMock} isRootCauseSelectionStep />
    );

    await userEvent.click(screen.getAllByText('Propose your own root cause')[0]!);
    const customInput = screen.getByPlaceholderText('Propose your own root cause...');
    await userEvent.type(customInput, 'Custom root cause');

    expect(mockButton).toHaveBeenLastCalledWith(
      expect.objectContaining({
        analyticsEventKey: 'autofix.create_fix_clicked',
        analyticsEventName: 'Autofix: Create Fix Clicked',
        analyticsParams: {
          group_id: '123',
          type: 'custom',
        },
      }),
      expect.anything()
    );
  });

  it('passes correct analytics props for Create PR button', async () => {
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

    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Use this code'}));

    // Find the last call to Button that matches our Create PR button
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

  it('passes correct analytics props for Create PR Setup button', async () => {
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

    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Use this code'}));

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
});
