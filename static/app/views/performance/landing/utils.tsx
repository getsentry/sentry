import type {Location} from 'history';

import type {EventView} from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export enum LandingDisplayField {
  ALL = 'all',
  FRONTEND_PAGELOAD = 'frontend_pageload',
  FRONTEND_OTHER = 'frontend_other',
  BACKEND = 'backend',
  MOBILE = 'mobile',
}

export function excludeTransaction(
  transaction: string | number,
  props: {eventView: EventView; location: Location; navigate: ReactRouter3Navigate}
) {
  const {eventView, location, navigate} = props;

  const searchConditions = new MutableSearch(eventView.query);
  searchConditions.addFilterValues('!transaction', [`${transaction}`]);

  navigate({
    pathname: location.pathname,
    query: {
      ...location.query,
      cursor: undefined,
      query: searchConditions.formatString(),
    },
  });
}
