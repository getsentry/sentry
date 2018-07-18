export default function replaceRouterParams(route, params) {
  // parse route params from route
  let matches = route.match(/:\w+/g);

  if (!matches || !matches.length) {
    return route;
  }

  // replace with current params
  matches.forEach(param => {
    let paramName = param.slice(1);
    if (typeof params[paramName] === 'undefined') return;

    route = route.replace(param, params[paramName]);
  });

  return route;
}
