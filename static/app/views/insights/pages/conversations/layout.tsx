import {Outlet} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout';

import {ConversationsPageHeader} from 'sentry/views/insights/pages/conversations/conversationsPageHeader';

function ConversationsLayout() {
  return (
    <Stack flex={1}>
      <ConversationsPageHeader />
      <Outlet />
    </Stack>
  );
}

export default ConversationsLayout;
