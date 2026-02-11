import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {ConversationsPageHeader} from 'sentry/views/insights/pages/conversations/conversationsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function ConversationsLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? (
        <ConversationsPageHeader module={handle.module} />
      ) : null}
      <Outlet />
    </Fragment>
  );
}

export default ConversationsLayout;
