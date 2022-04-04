import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

type NavigateOptions = {
  replace?: boolean;
  state?: any;
};

export function useNavigate() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error('useNavigate called outside of routes provider');
  }
  const navigator = route?.router;

  const navigate = (to: string | number, options: NavigateOptions = {}) => {
    if (typeof to === 'number') {
      navigator.go(to);
      return;
    }
    (!!options.replace ? navigator.replace : navigator.push)({
      pathname: to,
      state: options.state,
    });
  };
  return navigate;
}
