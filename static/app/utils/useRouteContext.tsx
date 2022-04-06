import {useContext} from 'react';

import {RouteContext} from 'sentry/views/routeContext';

function getCallerName() {
  try {
    throw new Error();
  } catch (e) {
    // matches this function, the caller and the parent
    const allMatches = e.stack.match(/(\w+)@|at (\w+) \(/g);
    // match parent function name
    const parentMatches = allMatches[2].match(/(\w+)@|at (\w+) \(/);
    // return only name
    return parentMatches[1] || parentMatches[2];
  }
}
export function useRouteContext() {
  const route = useContext(RouteContext);
  if (route === null) {
    throw new Error(`${getCallerName()} called outside of routes provider`);
  }
  return route;
}
