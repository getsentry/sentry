/**
 * Creates a route string from an array of `routes` from react-router
 * Note this is currently only used for error context logging. It does
 * not attempt to do anything smart (e.g. absolute vs relative paths in the list)
 *
 * @param {Array<{}>} routes An array of route objects from react-router
 * @return String Returns a route path
 */
export default function getRouteStringFromRoutes(routes) {
  if (!Array.isArray(routes)) return '';

  // Strip the first route (path: '/') since the subsequent children routes
  // are all absolute paths
  return (
    routes
      .splice(1)
      .filter(({path}) => path)
      .map(({path}) => path)
      .join('') || ''
  );
}
