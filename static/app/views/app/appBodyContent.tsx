import {Fragment} from 'react';

import SystemAlerts from 'sentry/views/app/systemAlerts';

interface AppContentProps {
  children: React.ReactNode;
}

export function AppBodyContent({children}: AppContentProps) {
  return (
    <Fragment>
      <SystemAlerts className="messages-container" />
      {children}
    </Fragment>
  );
}
