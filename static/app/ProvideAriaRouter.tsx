import {useHref} from 'react-router-dom';
import {RouterProvider as AriaRouterProvider} from '@react-aria/utils';

import {useNavigate} from 'sentry/utils/useNavigate';
/**
 * React aira has its own context for internal hooks/components. Links, Menu, Tabs, etc.
 * We need to provide the router instance so it knows how to navigate.
 * @link https://react-spectrum.adobe.com/react-aria/routing.html#react-router
 */
export function ProvideAriaRouter({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();
  return (
    <AriaRouterProvider navigate={navigate} useHref={useHref}>
      {children}
    </AriaRouterProvider>
  );
}
