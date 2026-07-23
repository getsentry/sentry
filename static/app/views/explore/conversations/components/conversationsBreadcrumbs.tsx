import {InfoText} from '@sentry/scraps/info';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/explore/conversations/settings';

interface ConversationsBreadcrumbsProps {
  conversationId: string;
  project?: AvatarProject;
}

export function ConversationsBreadcrumbs({
  conversationId,
  project,
}: ConversationsBreadcrumbsProps) {
  const organization = useOrganization();
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  return (
    <Breadcrumbs
      crumbs={[
        {
          label: CONVERSATIONS_SIDEBAR_LABEL,
          to: {
            pathname: conversationsBaseUrl,
            query: {
              statsPeriod: '24h',
              start: undefined,
              end: undefined,
              referrer: 'conversations-breadcrumb',
            },
          },
          preservePageFilters: true,
        },
        {
          label: (
            <ConversationCrumb
              conversationId={conversationId}
              project={project}
              organization={organization}
            />
          ),
        },
      ]}
    />
  );
}

function ConversationCrumb({
  conversationId,
  project,
  organization,
}: {
  conversationId: string;
  organization: Organization;
  project?: AvatarProject;
}) {
  const displayId = isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;

  return (
    <RevealOnHover minWidth={0}>
      {project && (
        <ProjectBadge
          project={project}
          avatarSize={16}
          disableLink
          hideName
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
      )}
      <InfoText
        title={conversationId}
        mode={isUUID(conversationId) ? undefined : 'overflowOnly'}
        variant="inherit"
      >
        {displayId}
      </InfoText>
      <RevealOnHover.Action>
        <CopyToClipboardButton
          size="zero"
          variant="transparent"
          aria-label={t('Copy conversation ID')}
          tooltipProps={{title: t('Copy conversation ID')}}
          text={conversationId}
          onCopy={() =>
            trackAnalytics('conversations.detail.copy-conversation-id', {organization})
          }
        />
      </RevealOnHover.Action>
    </RevealOnHover>
  );
}
