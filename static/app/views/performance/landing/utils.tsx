import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {EventView} from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export enum LandingDisplayField {
  ALL = 'all',
  FRONTEND_PAGELOAD = 'frontend_pageload',
  FRONTEND_OTHER = 'frontend_other',
  BACKEND = 'backend',
  MOBILE = 'mobile',
}

// TODO Abdullah Khan: Remove code for Web Vitals tab in performance landing
// page when new starfish web vitals module is mature.
const LANDING_DISPLAYS = [
  {
    label: t('All Transactions'),
    field: LandingDisplayField.ALL,
  },
  {
    label: t('Frontend'),
    field: LandingDisplayField.FRONTEND_OTHER,
  },
  {
    label: t('Backend'),
    field: LandingDisplayField.BACKEND,
  },
  {
    label: t('Mobile'),
    field: LandingDisplayField.MOBILE,
  },
];

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

export function getLandingDisplayFromParam(location: Location) {
  const landingField = decodeScalar(location?.query?.landingDisplay);

  const display = LANDING_DISPLAYS.find(({field}) => field === landingField);
  return display;
}

export function checkIsReactNative(eventView: EventView) {
  // only react native should contain the stall percentage column
  return eventView
    .getFields()
    .some(field => field.includes('measurements.stall_percentage'));
}
