import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router';

import {ModuleName} from 'sentry/views/insights/types';

import {BackendHeader} from './backendPageHeader';

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
