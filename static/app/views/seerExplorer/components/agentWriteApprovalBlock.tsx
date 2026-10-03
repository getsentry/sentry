import {useState} from 'react';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  AgentWriteApprovalResult,
  getScopeDetails,
  isApiAccessScope,
} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import type {ApiAccessScope} from 'sentry/constants/scopes';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  PendingUserInput,
  RespondToUserInputOptions,
} from 'sentry/views/seerExplorer/types';

interface AgentApprovalResponse {
  scopes: ApiAccessScope[];
}

interface PendingAgentWriteApproval {
  requiredScopes: ApiAccessScope[];
  sessionId: string;
}

interface AgentWriteApprovalBlockProps {
  pendingInput: PendingUserInput;
  readOnly: boolean;
  respondToUserInput: (
    inputId: string,
    responseData?: Record<string, unknown>,
    options?: RespondToUserInputOptions
  ) => void;
  /** Overrides the grant request, for stories that run without a backend. */
  requestApproval?: (
    sessionId: string,
    scopes: ApiAccessScope[]
  ) => Promise<AgentApprovalResponse>;
}

/**
 * The prompt for a pending `agent_write_approval` input, rendered above the composer alongside
 * the other pending-input blocks. Approving mints the grant in Sentry first and only resumes the
 * agent once every requested scope was granted.
 *
 * Key it by the input id: the submitted decision is local state for one request.
 */
export function AgentWriteApprovalBlock({
  pendingInput,
  readOnly,
  requestApproval,
  respondToUserInput,
}: AgentWriteApprovalBlockProps) {
  const organization = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedDecision, setSubmittedDecision] = useState<'approve' | 'reject' | null>(
    null
  );

  if (pendingInput.input_type !== 'agent_write_approval') {
    return null;
  }

  const inputId = pendingInput.id;
  const pendingApproval = getPendingAgentWriteApproval(pendingInput);
  const displayedScopes = pendingApproval?.requiredScopes ?? [];

  // The response failed to send; show the approval prompt again so it can be retried.
  function resetDecision() {
    setSubmittedDecision(null);
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
        respondToUserInput(inputId, {decision}, {onError: resetDecision});
        return;
      }
      addErrorMessage(t('You do not have all the requested permissions.'));
      respondToUserInput(
        inputId,
        {decision, reason: 'insufficient_scope'},
        {onError: resetDecision}
      );
    } catch {
      addErrorMessage(t('Failed to approve this permission.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReject() {
    setSubmittedDecision('reject');
    respondToUserInput(inputId, {decision: 'reject'}, {onError: resetDecision});
  }

  return (
    <Container padding="0 xl" data-test-id="agent-write-approval-block">
      <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
        {/* Holds the decision until the next poll clears the pending input. */}
        {submittedDecision ? (
          <AgentWriteApprovalResult
            scopes={displayedScopes}
            status={submittedDecision === 'approve' ? 'approved' : 'rejected'}
          />
        ) : (
          <Alert variant="info">
            <Stack gap="lg">
              <Text bold>{t('Allow Seer to make changes?')}</Text>

              {displayedScopes.length > 0 && (
                <Stack gap="2xs">
                  <Text bold size="sm">
                    {t('Requested scopes:')}
                  </Text>
                  {displayedScopes.map(scope => (
                    <PendingScope key={scope} scope={scope} />
                  ))}
                </Stack>
              )}

              {readOnly ? (
                <Text size="sm" variant="muted">
                  {t('Waiting for the conversation owner to respond.')}
                </Text>
              ) : (
                <Flex gap="sm">
                  <Button size="sm" onClick={handleReject} disabled={isSubmitting}>
                    {t('Reject')}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleApprove}
                    busy={isSubmitting}
                    disabled={!pendingApproval}
                  >
                    {t('Approve')}
                  </Button>
                </Flex>
              )}
            </Stack>
          </Alert>
        )}
      </motion.div>
    </Container>
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

function getPendingAgentWriteApproval(
  pendingInput: PendingUserInput
): PendingAgentWriteApproval | null {
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
