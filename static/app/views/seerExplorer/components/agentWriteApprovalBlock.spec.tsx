import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiAccessScope} from 'sentry/constants/scopes';
import {AgentWriteApprovalBlock} from 'sentry/views/seerExplorer/components/agentWriteApprovalBlock';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

const APPROVAL_ID = '11111111-1111-4111-8111-111111111111';

function createPendingAgentApproval(
  requiredScopes: ApiAccessScope[] = ['project:write'],
  sessionId = '123'
): PendingUserInput {
  return {
    id: APPROVAL_ID,
    input_type: 'agent_write_approval',
    data: {required_scopes: requiredScopes, session_id: sessionId},
  };
}

describe('AgentWriteApprovalBlock', () => {
  it('renders the requested scopes with actions', () => {
    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval()}
        readOnly={false}
        respondToUserInput={jest.fn()}
      />
    );

    expect(screen.getByText('Allow Seer to make changes?')).toBeInTheDocument();
    expect(screen.getByText('project:write')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Approve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Reject'})).toBeEnabled();
  });

  it('waits on the conversation owner when read-only', () => {
    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval()}
        readOnly
        respondToUserInput={jest.fn()}
      />
    );

    expect(
      screen.getByText('Waiting for the conversation owner to respond.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Approve'})).not.toBeInTheDocument();
  });

  it('uses pending input data when minting an approval', async () => {
    const organization = OrganizationFixture();
    const respondToUserInput = jest.fn();
    const approveRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agent/approve/`,
      method: 'POST',
      body: {
        status: 'approved',
        scopes: ['project:write'],
        expiresAt: '2026-08-05T12:00:00Z',
      },
    });

    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval(['project:write'], 'trusted-session')}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    await waitFor(() => {
      expect(approveRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/agent/approve/`,
        expect.objectContaining({
          data: {sessionId: 'trusted-session', scopes: ['project:write']},
          method: 'POST',
        })
      );
    });
    expect(respondToUserInput).toHaveBeenCalledWith(
      APPROVAL_ID,
      {decision: 'approve'},
      {onError: expect.any(Function)}
    );
  });

  it('approves in Sentry before resuming the agent', async () => {
    const organization = OrganizationFixture();
    const respondToUserInput = jest.fn();
    const {promise, resolve} = Promise.withResolvers<{
      expiresAt: string;
      scopes: string[];
      status: string;
    }>();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agent/approve/`,
      method: 'POST',
      body: promise,
    });

    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval()}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));
    expect(respondToUserInput).not.toHaveBeenCalled();

    resolve({
      status: 'approved',
      scopes: ['project:write'],
      expiresAt: '2026-08-05T12:00:00Z',
    });

    await waitFor(() => {
      expect(respondToUserInput).toHaveBeenCalledWith(
        APPROVAL_ID,
        {decision: 'approve'},
        {onError: expect.any(Function)}
      );
    });
    expect(
      await screen.findByText('Access granted for reading and writing Projects')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Reject'})).not.toBeInTheDocument();
  });

  it('does not resume with approval when only some scopes are granted', async () => {
    const organization = OrganizationFixture();
    const respondToUserInput = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agent/approve/`,
      method: 'POST',
      body: {
        status: 'approved',
        scopes: ['project:write'],
        expiresAt: '2026-08-05T12:00:00Z',
      },
    });

    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval(['project:write', 'event:write'])}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    await waitFor(() => {
      expect(respondToUserInput).toHaveBeenCalledWith(
        APPROVAL_ID,
        {decision: 'reject', reason: 'insufficient_scope'},
        {onError: expect.any(Function)}
      );
    });
    expect(
      await screen.findByText(
        'Access not granted for reading and writing Projects, reading and writing Issues & Events'
      )
    ).toBeInTheDocument();
  });

  it('rejects without creating a Sentry grant', async () => {
    const organization = OrganizationFixture();
    const respondToUserInput = jest.fn();
    const approveRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agent/approve/`,
      method: 'POST',
    });

    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval()}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Reject'}));

    expect(respondToUserInput).toHaveBeenCalledWith(
      APPROVAL_ID,
      {decision: 'reject'},
      {onError: expect.any(Function)}
    );
    expect(approveRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText('Access not granted for reading and writing Projects')
    ).toBeInTheDocument();
  });

  it('allows an approval with invalid grant data to be rejected', async () => {
    const respondToUserInput = jest.fn();
    const pendingInput = createPendingAgentApproval();
    pendingInput.data = {};

    render(
      <AgentWriteApprovalBlock
        pendingInput={pendingInput}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />
    );

    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    await userEvent.click(screen.getByRole('button', {name: 'Reject'}));

    expect(respondToUserInput).toHaveBeenCalledWith(
      APPROVAL_ID,
      {decision: 'reject'},
      {onError: expect.any(Function)}
    );
  });

  it('shows the approval prompt again when the response fails to send', async () => {
    const respondToUserInput = jest.fn(
      (_inputId: string, _data?: unknown, options?: {onError?: () => void}) =>
        options?.onError?.()
    );

    render(
      <AgentWriteApprovalBlock
        pendingInput={createPendingAgentApproval()}
        readOnly={false}
        respondToUserInput={respondToUserInput}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Reject'}));

    expect(respondToUserInput).toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Reject'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Approve'})).toBeInTheDocument();
  });
});
