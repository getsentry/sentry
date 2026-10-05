import {useMemo} from 'react';
import {
  MemoryRouter as ReactMemoryRouter,
  useMatches as useReactRouterMatches,
  type MemoryRouterProps,
} from 'react-router';
import type {UIMatch} from 'react-router-dom';
import {
  RouterProvider as ReactRouterProvider,
  type RouterProviderProps,
} from 'react-router/dom';

export {
  Link,
  NavLink,
  Navigate,
  Outlet,
  ScrollRestoration,
  UNSAFE_DataRouterContext,
  createBrowserRouter,
  createMemoryRouter,
  createRoutesFromChildren,
  generatePath,
  matchRoutes,
  unstable_usePrompt,
  useBlocker,
  useHref,
  useLocation,
  useNavigate,
  useNavigationType,
  useOutlet,
  useOutletContext,
  useParams,
  useRouteError,
  useSearchParams,
  type LinkProps,
  type Location,
  type NavigateFunction,
  type NavigateOptions,
  type NavigateProps,
  type RouteObject,
  type To,
  type DataRouter,
} from 'react-router';

export type {UIMatch} from 'react-router-dom';
export {NuqsAdapter} from 'nuqs/adapters/react-router/v8';

export function RouterProvider(props: RouterProviderProps) {
  return <ReactRouterProvider {...props} useTransitions={false} />;
}

export function MemoryRouter(props: MemoryRouterProps) {
  return <ReactMemoryRouter {...props} useTransitions={false} />;
}

// Keep the shared API compatible with production's v6 route matches.
export function useMatches(): UIMatch[] {
  const matches = useReactRouterMatches();
  return useMemo(
    () => matches.map(({loaderData, ...match}) => ({...match, data: loaderData})),
    [matches]
  );
}
