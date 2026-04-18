import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import SystemAlerts from './systemAlerts';

interface AppContentProps {
  children: React.ReactNode;
}

/**
 * Wraps the body content of the app. For organization routes,
 * this is the main content which excludes the sidebar.
 *
 * For now, this just provides system alerts, which should be visible
 * on all pages.
 */
export function AppBodyContent({children}: AppContentProps) {
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Fragment>
      {/* In page frame mode, SystemAlerts are rendered below the sticky TopBar
          in organizationLayout to prevent them from scrolling away out of view */}
      {!hasPageFrame && <SystemAlerts className="messages-container" />}
      {children}
    </Fragment>
  );
}

/**
 * Route component version that renders children via Outlet.
 */
export function AppBodyContentRoute() {
  return (
    <AppBodyContent>
      <Outlet />
    </AppBodyContent>
  );
}
