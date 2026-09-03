import {t} from 'sentry/locale';

export const USER_SESSIONS_SUB_PATH = 'usersessions';
export const USER_SESSIONS_TITLE = t('Sessions');

/**
 * How many sessions each dataset contributes to the candidate set, and how many
 * rows we ultimately render. The union of each dataset's top-N by recency
 * contains the global top-N by recency, so the rendered set is exact even
 * though it is assembled from separate queries.
 */
export const SESSIONS_PER_PAGE = 50;
