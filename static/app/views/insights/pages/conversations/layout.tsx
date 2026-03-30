import {Outlet, useMatches} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout';

import {ConversationsPageHeader} from 'sentry/views/insights/pages/conversations/conversationsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function ConversationsLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Stack flex={1}>
      {handle && 'module' in handle ? (
        <ConversationsPageHeader module={handle.module} />
      ) : null}
      <Outlet />
    </Stack>
  );
}

export default ConversationsLayout;
