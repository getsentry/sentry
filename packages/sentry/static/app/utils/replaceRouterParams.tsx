/**
 * Given a route string, replace path parameters (e.g. `:id`) with value from `params`
 *
 * e.g. {id: 'test'}
 */
export default function replaceRouterParams(
  route: string,
  params: {[key: string]: string | number | undefined}
): string {
  // parse route params from route
  const matches = route.match(/:\w+/g);

  if (!matches || !matches.length) {
    return route;
  }

  // replace with current params
  matches.forEach(param => {
    const paramName = param.slice(1);
    if (typeof params[paramName] === 'undefined') {
      return;
    }

    route = route.replace(param, String(params[paramName]));
  });

  return route;
}
