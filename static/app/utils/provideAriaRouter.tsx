import {useCallback} from 'react';
import {useHref} from 'react-router-dom';
import {RouterProvider as AriaRouterProvider} from '@react-aria/utils';

import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * React aira has its own context for useTabs, useMenuItem, useLink, etc.
 * We need to provide the router instance so it knows how to navigate.
 * @link https://react-spectrum.adobe.com/react-aria/routing.html#react-router
 */
export function ProvideAriaRouter({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();

  const handleNavigate = useCallback<typeof navigate>(
    path => {
      if (typeof path === 'number') {
        navigate(path);
        return;
      }

      const pathString = typeof path === 'string' ? path : path.pathname;
      // Prevent navigation to external links via router
      if (pathString?.startsWith('http')) {
        return;
      }

      navigate(path);
    },
    [navigate]
  );

  return (
    <AriaRouterProvider
      navigate={handleNavigate}
      // oxlint-disable-next-line react/hooks -- react-aria RouterProvider takes useHref as a value and calls it internally.
      useHref={useHref}
    >
      {children}
    </AriaRouterProvider>
  );
}
