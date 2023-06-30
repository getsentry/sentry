import {Location} from 'history';

export function extractRoute(location: Location) {
  if (location.pathname.match(/^\/starfish\/api\//)) {
    return 'api';
  }
  if (location.pathname.match(/^\/starfish\/database\//)) {
    return 'database';
  }
  if (location.pathname.match(/^\/starfish\/endpoint-overview\//)) {
    return 'endpoint-overview';
  }
  return null;
}
