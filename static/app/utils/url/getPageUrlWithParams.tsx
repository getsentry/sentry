import type {Location} from 'history';

export function getPageUrlWithParams(
  location: Location,
  edit: (params: URLSearchParams) => void
): string {
  const url = new URL(location.pathname, window.location.origin);
  const params = new URLSearchParams(location.search);
  edit(params);
  url.search = params.toString();
  return url.toString();
}
