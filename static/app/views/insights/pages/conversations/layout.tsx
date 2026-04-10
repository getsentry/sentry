import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {ConversationsPageHeader} from 'sentry/views/insights/pages/conversations/conversationsPageHeader';

function ConversationsLayout() {
  const {conversationId} = useParams<{conversationId?: string}>();

  const isDetailPage = !!conversationId;

  return (
    <Stack flex={1}>
      {isDetailPage ? (
        <DetailHeaderWrapper>
          <ConversationsPageHeader
            hideDefaultTabs
            headerTitle={<Fragment />}
            breadcrumbs={[{label: conversationId.slice(0, 8)}]}
          />
        </DetailHeaderWrapper>
      ) : (
        <ConversationsPageHeader />
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
