import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router-dom';

import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function BackendLayout() {
  const handle = useMatches().at(-1)?.handle as {module?: ModuleName} | undefined;

  return (
    <Fragment>
      {handle && 'module' in handle ? <BackendHeader module={handle.module} /> : null}
      <Outlet />
    </Fragment>
  );
}

export default BackendLayout;
