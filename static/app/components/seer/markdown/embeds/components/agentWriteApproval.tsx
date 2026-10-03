import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {API_ACCESS_SCOPE_DETAILS, type ApiAccessScope} from 'sentry/constants/scopes';
import {IconCheckmark, IconClock, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type AgentWriteApprovalStatus = EmbedOutput<'agentWriteApproval'>['status'];

const APPROVAL_STATUS_LABELS: Record<AgentWriteApprovalStatus, string> = {
  pending: t('pending'),
  approved: t('approved'),
  rejected: t('rejected'),
};

/**
 * Records the request where it happened in the reasoning trace. The actionable prompt renders
 * above the composer instead (`AgentWriteApprovalBlock`), where it can't be hidden inside a
 * collapsed thinking block.
 */
export const AgentWriteApprovalEmbed = defineSeerEmbed({
  name: 'agentWriteApproval',
  render(props, level) {
    switch (level) {
      case 'markdown':
        // An approval prompt is an action, not content: record only that it
        // was asked and how it was answered.
        return t('Seer permission request (%s)', APPROVAL_STATUS_LABELS[props.status]);
      case 'block':
      case 'inline':
        return (
          <AgentWriteApprovalResult scopes={props.requiredScopes} status={props.status} />
        );
    }
  },
});

export function AgentWriteApprovalResult({
  scopes,
  status,
}: {
  scopes: string[];
  status: AgentWriteApprovalStatus;
}) {
  const scopeAccess = scopes.map(scope => getScopeAccess(scope)).join(', ');

  return (
    <Container
      data-test-id="agent-write-approval-result"
      width="fit-content"
      maxWidth="100%"
      padding="sm"
      border="primary"
      radius="md"
      background="secondary"
      onClick={event => event.stopPropagation()}
    >
      <Flex gap="sm" align="center">
        {status === 'approved' ? (
          <IconCheckmark size="sm" variant="success" />
        ) : status === 'rejected' ? (
          <IconClose size="sm" variant="danger" />
        ) : (
          <IconClock size="sm" variant="muted" />
        )}
        <Text size="sm">
          {status === 'approved'
            ? t('Access granted for %s', scopeAccess)
            : status === 'rejected'
              ? t('Access not granted for %s', scopeAccess)
              : t('Access requested for %s', scopeAccess)}
        </Text>
      </Flex>
    </Container>
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

export function getScopeDetails(scope: string) {
  return isApiAccessScope(scope) ? API_ACCESS_SCOPE_DETAILS[scope] : undefined;
}

export function isApiAccessScope(scope: unknown): scope is ApiAccessScope {
  return typeof scope === 'string' && scope in API_ACCESS_SCOPE_DETAILS;
}
