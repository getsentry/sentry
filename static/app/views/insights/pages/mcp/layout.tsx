import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router';

import {ModuleName} from 'sentry/views/insights/types';

import {MCPPageHeader} from './mcpPageHeader';

function MCPLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? <MCPPageHeader module={handle.module} /> : null}
      <Outlet />
    </Fragment>
  );
}

export default MCPLayout;
