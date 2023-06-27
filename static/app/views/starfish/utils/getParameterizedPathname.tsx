import {useLocation} from 'sentry/utils/useLocation';

export function useStarfishParameterizedPathname() {
  const {pathname} = useLocation();
  // No other good way to get parameterized pathname on current version of react-router
  const parameterizedPathname = pathname.replace(
    /\/span\/[a-z0-9]+\/$/,
    '/span/:spanId/'
  );
  return parameterizedPathname;
}
