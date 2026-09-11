import type {Location} from 'history';

import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

/**
 * Plenty of the widgets embeds reuse take a router location and a navigate
 * callback so that, on their own pages, they can round-trip their query params.
 * An embed must read neither and write neither -- see this directory's README --
 * so it hands them this pair instead: a location with nothing in it, and a
 * navigate that goes nowhere.
 *
 * A widget given these still renders; it just cannot reach the host page. Where
 * one builds a link out of the location, it falls back to building it from the
 * data it was handed, which is what an embed wants anyway.
 */
export const INERT_LOCATION: Location = {
  pathname: '',
  search: '',
  hash: '',
  query: {},
  state: null,
  key: '',
  action: 'POP',
};

export const INERT_NAVIGATE: ReactRouter3Navigate = () => {};
