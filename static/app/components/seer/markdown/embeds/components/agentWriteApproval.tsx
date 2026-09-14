import {createContext, useContext, useState, type ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {API_ACCESS_SCOPE_DETAILS, type ApiAccessScope} from 'sentry/constants/scopes';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

interface AgentWriteApprovalContextValue {
  pendingInput: PendingUserInput | null;
  readOnly: boolean;
  requestApproval?: RequestApproval;
  respondToUserInput?: (inputId: string, responseData?: Record<string, unknown>) => void;
}

interface AgentApprovalResponse {
  scopes: ApiAccessScope[];
}

interface PendingAgentWriteApproval {
  requiredScopes: ApiAccessScope[];
  sessionId: string;
}

type RequestApproval = (
  sessionId: string,
  scopes: ApiAccessScope[]
) => Promise<AgentApprovalResponse>;

const AgentWriteApprovalContext = createContext<AgentWriteApprovalContextValue>({
  pendingInput: null,
  readOnly: true,
});

export function AgentWriteApprovalProvider({
  children,
  pendingInput,
  readOnly = false,
  requestApproval,
  respondToUserInput,
}: Omit<AgentWriteApprovalContextValue, 'readOnly'> & {
  children: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <AgentWriteApprovalContext.Provider
      value={{pendingInput, readOnly, requestApproval, respondToUserInput}}
    >
      {children}
    </AgentWriteApprovalContext.Provider>
  );
}

export const AgentWriteApprovalEmbed = defineSeerEmbed({
  name: 'agentWriteApproval',
  render(props) {
    return <AgentWriteApprovalContent {...props} />;
  },
});

function AgentWriteApprovalContent({
  inputId,
  requiredScopes,
  status,
}: EmbedOutput<'agentWriteApproval'>) {
  const organization = useOrganization();
  const {pendingInput, readOnly, requestApproval, respondToUserInput} = useContext(
    AgentWriteApprovalContext
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedDecision, setSubmittedDecision] = useState<'approve' | 'reject' | null>(
    null
  );
  const isActive =
    pendingInput?.input_type === 'agent_write_approval' && pendingInput.id === inputId;
  const pendingApproval = getPendingAgentWriteApproval(pendingInput, inputId);
  const canRespond =
    status === 'pending' && isActive && !readOnly && !!respondToUserInput;
  let displayStatus = status;
  if (status === 'pending' && submittedDecision) {
    displayStatus = submittedDecision === 'approve' ? 'approved' : 'rejected';
  }

  async function handleApprove() {
    if (!pendingApproval) {
      return;
    }
    setIsSubmitting(true);
    try {
      const response = requestApproval
        ? await requestApproval(pendingApproval.sessionId, pendingApproval.requiredScopes)
        : await fetchMutation<AgentApprovalResponse>({
            url: getApiUrl('/organizations/$organizationIdOrSlug/agent/approve/', {
              path: {organizationIdOrSlug: organization.slug},
            }),
            method: 'POST',
            data: {
              sessionId: pendingApproval.sessionId,
              scopes: pendingApproval.requiredScopes,
            },
          });
      const decision = pendingApproval.requiredScopes.every(scope =>
        response.scopes.includes(scope)
      )
        ? 'approve'
        : 'reject';
      setSubmittedDecision(decision);
      if (decision === 'approve') {
        respondToUserInput?.(inputId, {decision});
        return;
      }
      addErrorMessage(t('You do not have all the requested permissions.'));
      respondToUserInput?.(inputId, {decision, reason: 'insufficient_scope'});
    } catch {
      addErrorMessage(t('Failed to approve this permission.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject() {
    setSubmittedDecision('reject');
    respondToUserInput?.(inputId, {decision: 'reject'});
  }

  const displayedScopes = pendingApproval?.requiredScopes ?? requiredScopes;
  const grantedScopeAccess = displayedScopes
    .map(scope => getScopeAccess(scope))
    .join(', ');

  if (displayStatus !== 'pending') {
    return (
      <Container
        data-test-id="agent-write-approval-embed"
        width="fit-content"
        maxWidth="100%"
        padding="sm"
        border="primary"
        radius="md"
        background="secondary"
        onClick={event => event.stopPropagation()}
      >
        <Flex gap="sm" align="center">
          {displayStatus === 'approved' ? (
            <IconCheckmark size="sm" variant="success" />
          ) : (
            <IconClose size="sm" variant="danger" />
          )}
          <Text size="sm">
            {displayStatus === 'approved'
              ? t('Access granted for %s', grantedScopeAccess)
              : t('Access not granted for %s', grantedScopeAccess)}
          </Text>
        </Flex>
      </Container>
    );
  }

  return (
    <Alert
      data-test-id="agent-write-approval-embed"
      variant="info"
      onClick={event => event.stopPropagation()}
    >
      <Stack gap="lg">
        <Text bold>{t('Allow Seer to make changes?')}</Text>

        <Stack gap="2xs">
          <Text bold size="sm">
            {t('Requested scopes:')}
          </Text>
          {displayedScopes.map(scope => (
            <PendingScope key={scope} scope={scope} />
          ))}
        </Stack>

        {canRespond && (
          <Flex gap="sm">
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isSubmitting || submittedDecision !== null}
            >
              {t('Reject')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleApprove}
              busy={isSubmitting || submittedDecision === 'approve'}
              disabled={!pendingApproval || submittedDecision === 'reject'}
            >
              {t('Approve')}
            </Button>
          </Flex>
        )}
        {!canRespond && (
          <Text size="sm" variant="muted">
            {readOnly && isActive
              ? t('Waiting for the conversation owner to respond.')
              : t('This approval request is no longer active.')}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

function PendingScope({scope}: {scope: string}) {
  const details = getScopeDetails(scope);

  return (
    <Flex gap="xs" align="baseline" wrap="wrap">
      <Text size="sm">{details?.resource ?? t('Sentry Permission')},</Text>
      <Text size="sm" monospace>
        {scope}
      </Text>
    </Flex>
  );
}

function getScopeAccess(scope: string) {
  const details = getScopeDetails(scope);
  if (!details) {
    return t('using the %s scope', scope);
  }

  const action =
    details.access === 'read'
      ? t('reading')
      : details.access === 'readWrite'
        ? t('reading and writing')
        : t('managing');
  return t('%s %s', action, details.resource);
}

function getScopeDetails(scope: string) {
  return isApiAccessScope(scope) ? API_ACCESS_SCOPE_DETAILS[scope] : undefined;
}

function getPendingAgentWriteApproval(
  pendingInput: PendingUserInput | null,
  inputId: string
): PendingAgentWriteApproval | null {
  if (
    pendingInput?.input_type !== 'agent_write_approval' ||
    pendingInput.id !== inputId
  ) {
    return null;
  }

  const requiredScopes: unknown = pendingInput.data.required_scopes;
  const sessionId: unknown = pendingInput.data.session_id;
  if (
    !Array.isArray(requiredScopes) ||
    requiredScopes.length === 0 ||
    !requiredScopes.every(isApiAccessScope) ||
    typeof sessionId !== 'string' ||
    sessionId.length === 0
  ) {
    return null;
  }

  return {requiredScopes, sessionId};
}

function isApiAccessScope(scope: unknown): scope is ApiAccessScope {
  return typeof scope === 'string' && scope in API_ACCESS_SCOPE_DETAILS;
}
