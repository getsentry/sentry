import type {Location} from 'history';
import * as qs from 'query-string';

import type {NavigateOptions} from 'sentry/router/reactRouter';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

interface NavigateTarget {
  query: Location['query'];
  pathname?: string;
}

export function navigateIfQueryChanged(
  navigate: ReactRouter3Navigate,
  location: Location,
  target: NavigateTarget,
  options?: NavigateOptions
): void {
  if (qs.stringify(target.query) !== qs.stringify(location.query)) {
    navigate({...target, pathname: target.pathname ?? location.pathname}, options);
  }
}
