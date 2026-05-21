import {Outlet} from 'react-router-dom';

interface AppContentProps {
  children: React.ReactNode;
}

/**
 * Wraps the body content of the app. For organization routes,
 * this is the main content which excludes the sidebar.
 */
export function AppBodyContent({children}: AppContentProps) {
  return children;
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
