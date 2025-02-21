import type {Location} from 'history';
import capitalize from 'lodash/capitalize';
import snakeCase from 'lodash/snakeCase';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';

/**
 * This converts parameters in a route to be the upper version of it with a slight adjustment with IDs
 * some_word becomes SomeWord
 * And :projectId becomes :ProjectId
 */
const camelCaseRouteParameter = (word: string) => {
  const tokens = word.match(/:(\w+)/);
  if (tokens) {
    const idToken = tokens[1]!;
    // only capitalize the first letter of the id
    // to keep 'Id' instead of 'id'
    return `:${capitalize(idToken[0])}${idToken.slice(1)}`;
  }
  return capitalize(word);
};

/**
 * @param routes Routes from React Router
 * @returns A string representing the route path
 * Ex: /organizations/:orgid/alerts/new/:alerttype/ ->
 * Organizations :orgid Alerts New :alerttype
 */
export function getEventPath(routes: PlainRoute[]) {
  const routeString = getRouteStringFromRoutes(routes);
  return routeString
    .split('/')
    .map(camelCaseRouteParameter)
    .filter(s => !!s)
    .join(' ');
}

/**
 * @param location Location from React Router
 * @returns A string representing the route path
 */
export function getUrlFromLocation(location: Location) {
  const previousUrlObj = new URL(window.location.origin + location.pathname);
  previousUrlObj.search = location.search;
  previousUrlObj.hash = location.hash;
  return previousUrlObj.toString();
}

/**
 * @param string representing the route path in Amplitude format
 * @return Reload representation of the route path
 * Ex: Organizations :OrgId Alerts New :AlertType ->
 * organizations.:org_id.alerts.new.:alert_type
 */
export function convertToReloadPath(routeString: string) {
  return routeString
    .split(' ')
    .map(tok => tok.replace(/[\w ]+/g, snakeCase))
    .join('.');
}
