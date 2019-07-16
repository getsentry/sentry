export default function replaceRouterParams(route, params) {
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

    route = route.replace(param, params[paramName]);
  });

  return route;
}
