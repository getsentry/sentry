import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {ConversationsPageHeader} from 'sentry/views/explore/conversations/conversationsPageHeader';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/explore/conversations/settings';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

function ConversationsLayout() {
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();
  const {conversationId} = useParams<{conversationId?: string}>();

  const isDetailPage = !!conversationId;
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  return (
    <Stack flex={1}>
      {isDetailPage ? (
        hasPageFrameFeature ? (
          <TopBar.Slot name="title">
            <Breadcrumbs
              crumbs={[
                {
                  label: CONVERSATIONS_SIDEBAR_LABEL,
                  to: conversationsBaseUrl,
                  preservePageFilters: true,
                },
                {label: conversationId.slice(0, 8)},
              ]}
            />
          </TopBar.Slot>
        ) : (
          <DetailHeaderWrapper>
            <ConversationsPageHeader
              domainBaseUrl={conversationsBaseUrl}
              hideDefaultTabs
              headerTitle={<Fragment />}
              breadcrumbs={[{label: conversationId.slice(0, 8)}]}
            />
          </DetailHeaderWrapper>
        )
      ) : (
        <ConversationsPageHeader domainBaseUrl={conversationsBaseUrl} />
      )}
      <Outlet />
    </Stack>
  );
}

const DetailHeaderWrapper = styled('div')`
  header {
    padding-left: ${p => p.theme.space['2xl']};
    padding-right: ${p => p.theme.space['2xl']};
  }
`;

export default ConversationsLayout;
