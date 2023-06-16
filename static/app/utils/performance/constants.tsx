import {URL_PARAM} from 'sentry/constants/pageFilters';

export const MAX_TEAM_KEY_TRANSACTIONS = 100;

export const PERFORMANCE_URL_PARAM = ['team', 'dataset', ...Object.values(URL_PARAM)];
