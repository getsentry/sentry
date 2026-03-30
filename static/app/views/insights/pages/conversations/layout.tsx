import {Outlet, useMatches} from 'react-router-dom';

import * as Layout from 'sentry/components/layouts/thirds';
import {ConversationsPageHeader} from 'sentry/views/insights/pages/conversations/conversationsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function ConversationsLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Layout.Page>
      {handle && 'module' in handle ? (
        <ConversationsPageHeader module={handle.module} />
      ) : null}
      <Outlet />
    </Layout.Page>
  );
}

export default ConversationsLayout;
