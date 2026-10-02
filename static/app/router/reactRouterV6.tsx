import {
  MemoryRouter as ReactMemoryRouter,
  RouterProvider as ReactRouterProvider,
  type MemoryRouterProps,
  type RouterProviderProps,
} from 'react-router-dom';

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
  useMatches,
  type UIMatch,
} from 'react-router-dom';
export type {Router as DataRouter} from '@remix-run/router';
export {NuqsAdapter} from 'nuqs/adapters/react-router/v6';

export function RouterProvider({
  useTransitions: _useTransitions,
  ...props
}: RouterProviderProps & {useTransitions?: false}) {
  return <ReactRouterProvider {...props} future={{v7_startTransition: false}} />;
}

export function MemoryRouter({
  useTransitions: _useTransitions,
  ...props
}: MemoryRouterProps & {useTransitions?: false}) {
  return (
    <ReactMemoryRouter {...props} future={{...props.future, v7_startTransition: false}} />
  );
}
