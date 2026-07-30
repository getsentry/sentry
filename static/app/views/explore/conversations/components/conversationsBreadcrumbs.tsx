import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {InfoText} from '@sentry/scraps/info';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/explore/conversations/settings';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasNewBreadcrumbs} from 'sentry/views/navigation/useHasNewBreadcrumbs';

const COPY_ID_LABEL = t('Copy conversation ID');

interface ConversationsBreadcrumbsProps {
  conversationId: string;
  project?: AvatarProject;
}

/** UUIDs are shown truncated, so the full value needs a tooltip to stay readable. */
function getDisplayId(conversationId: string) {
  return isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
}

function ConversationProjectBadge({project}: {project: AvatarProject}) {
  return (
    <ProjectBadge
      project={project}
      avatarSize={16}
      disableLink
      hideName
      avatarProps={{hasTooltip: true, tooltip: project.slug}}
    />
  );
}

export function ConversationsBreadcrumbs({
  conversationId,
  project,
}: ConversationsBreadcrumbsProps) {
  const organization = useOrganization();
  const hasNewBreadcrumbs = useHasNewBreadcrumbs();
  const location = useLocation();
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  // Carry project/environment filters back to the landing page, then force the
  // default 24h period. BreadcrumbList link items build their own query, so this
  // replaces the legacy `preservePageFilters` flag.
  const query = {
    ...extractSelectionParameters(location.query),
    statsPeriod: '24h',
    start: undefined,
    end: undefined,
    referrer: 'conversations-breadcrumb',
  };

  if (hasNewBreadcrumbs) {
    return (
      <Fragment>
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList
            items={[
              {
                type: 'link',
                label: CONVERSATIONS_SIDEBAR_LABEL,
                to: {pathname: conversationsBaseUrl, query},
              },
            ]}
          />
        </TopBar.Slot>
        <TopBar.Slot name="title">
          <BreadcrumbList.Title
            item={{
              type: 'page-title',
              label: getDisplayId(conversationId),
              labelTooltip: isUUID(conversationId) ? conversationId : undefined,
              leadingGraphic: project ? (
                <ConversationProjectBadge project={project} />
              ) : undefined,
              trailingActions: {
                type: 'copy',
                text: conversationId,
                label: COPY_ID_LABEL,
                tooltip: COPY_ID_LABEL,
                onCopy: () =>
                  trackAnalytics('conversations.detail.copy-conversation-id', {
                    organization,
                  }),
              },
            }}
          />
        </TopBar.Slot>
      </Fragment>
    );
  }

  // Legacy breadcrumbs (flag off).
  return (
    <TopBar.Slot name="title">
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
    </TopBar.Slot>
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
  return (
    <RevealOnHover minWidth={0}>
      {project && <ConversationProjectBadge project={project} />}
      <InfoText
        title={conversationId}
        mode={isUUID(conversationId) ? undefined : 'overflowOnly'}
        variant="inherit"
      >
        {getDisplayId(conversationId)}
      </InfoText>
      <RevealOnHover.Action>
        <CopyToClipboardButton
          size="zero"
          variant="transparent"
          aria-label={COPY_ID_LABEL}
          tooltipProps={{title: COPY_ID_LABEL}}
          text={conversationId}
          onCopy={() =>
            trackAnalytics('conversations.detail.copy-conversation-id', {organization})
          }
        />
      </RevealOnHover.Action>
    </RevealOnHover>
  );
}
