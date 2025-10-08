import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {AgentsPageHeader} from 'sentry/views/insights/pages/agents/agentsPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function AgentsLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? <AgentsPageHeader module={handle.module} /> : null}
      <Outlet />
    </Fragment>
  );
}

export default AgentsLayout;
