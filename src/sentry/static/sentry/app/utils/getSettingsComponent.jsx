// Load components based on route properties
//
// This is for new/old settings pages
//
// @return Promise<React.Component>
export default function getSettingsComponent(newComponent, oldComponent, routes) {
  // Use property on Route to see if it should be apart of new settings
  if (routes && routes.length > 0 && routes[1] && routes[1].newnew) {
    return newComponent().then(mod => mod.default);
  }

  return oldComponent().then(mod => mod.default);
}
