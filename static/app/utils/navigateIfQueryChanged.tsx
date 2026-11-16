import type {NavigateOptions} from 'react-router';
import type {Location} from 'history';

import {stringify} from './url/qs';
import type {ReactRouter3Navigate} from './useNavigate';

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
  if (stringify(target.query) !== stringify(location.query)) {
    navigate({...target, pathname: target.pathname ?? location.pathname}, options);
  }
}
