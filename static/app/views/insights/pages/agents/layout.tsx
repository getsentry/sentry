import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router';

import {ModuleName} from 'sentry/views/insights/types';

import {AgentsPageHeader} from './agentsPageHeader';

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
