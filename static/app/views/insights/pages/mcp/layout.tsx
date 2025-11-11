import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {MCPPageHeader} from 'sentry/views/insights/pages/mcp/mcpPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

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
