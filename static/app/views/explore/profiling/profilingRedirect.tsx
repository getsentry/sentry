import {Redirect} from 'sentry/components/redirect';
import {useLocation} from 'sentry/utils/useLocation';

export default function ProfilingRedirect() {
  const location = useLocation();
  const newPathname = location.pathname.replace(
    '/explore/profiling',
    '/explore/profiles'
  );
  return <Redirect to={newPathname + location.search + location.hash} />;
}
