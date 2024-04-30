import type {Location} from 'history';

export function extractRoute(location: Location) {
  if (location.pathname.match(/^\/starfish\/api\//)) {
    return 'api';
  }
  if (location.pathname.match(/^\/starfish\/database\//)) {
    return 'database';
  }
  return null;
}
