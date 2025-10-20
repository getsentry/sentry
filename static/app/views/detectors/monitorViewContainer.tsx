import {Outlet} from 'react-router-dom';

import {MonitorViewContext} from 'sentry/views/detectors/monitorViewContext';

export default function MonitorViewContainer() {
  return (
    <MonitorViewContext.Provider
      value={{
        monitorsLinkPrefix: `monitors`,
        automationsLinkPrefix: `automations`,
      }}
    >
      <Outlet />
    </MonitorViewContext.Provider>
  );
}
