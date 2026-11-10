import {Fragment} from 'react';
import {Outlet, useMatches} from 'react-router';

import {ModuleName} from 'sentry/views/insights/types';

import {FrontendHeader} from './frontendPageHeader';

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
