import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function FrontendLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? <FrontendHeader module={handle.module} /> : null}
      <Outlet />
    </Fragment>
  );
}

export default FrontendLayout;
