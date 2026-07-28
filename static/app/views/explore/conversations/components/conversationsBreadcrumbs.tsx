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

interface ConversationsBreadcrumbsProps {
  conversationId: string;
  project?: AvatarProject;
}

export function ConversationsBreadcrumbs({
  conversationId,
  project,
}: ConversationsBreadcrumbsProps) {
  const organization = useOrganization();
  const location = useLocation();
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );
  const displayId = isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;

  // Carry project/environment filters back to the landing page, then force the
  // default 24h period. BreadcrumbList link items build their own query, so this
  // replaces the legacy `preservePageFilters` flag.
  const landingQuery = {
    ...extractSelectionParameters(location.query),
    statsPeriod: '24h',
    start: undefined,
    end: undefined,
    referrer: 'conversations-breadcrumb',
  };

  if (organization.features.includes('ui-migration-breadcrumbs')) {
    return (
      <Fragment>
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList
            items={[
              {
                type: 'link',
                label: CONVERSATIONS_SIDEBAR_LABEL,
                to: {pathname: conversationsBaseUrl, query: landingQuery},
              },
            ]}
          />
        </TopBar.Slot>
        <TopBar.Slot name="title">
          <BreadcrumbList.Title
            item={{
              type: 'page-title',
              label: displayId,
              // Only shortened UUIDs need the full value revealed.
              labelTooltip: isUUID(conversationId) ? conversationId : undefined,
              leadingGraphic: project ? (
                <ProjectBadge
                  project={project}
                  avatarSize={16}
                  disableLink
                  hideName
                  avatarProps={{hasTooltip: true, tooltip: project.slug}}
                />
              ) : undefined,
              trailingActions: {
                type: 'copy',
                text: conversationId,
                label: t('Copy conversation ID'),
                tooltip: t('Copy conversation ID'),
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
