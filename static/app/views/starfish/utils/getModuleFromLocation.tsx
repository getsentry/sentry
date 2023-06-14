import {Location} from 'history';

import {t} from 'sentry/locale';

export const MODULES = {
  api: t('API Module'),
  database: t('DB Module'),
  'endpoint-overview': t('Endpoint Overview'),
};

export function getModuleFromLocation(location: Location) {
  if (location.pathname.match(/^\/starfish\/api\//)) {
    return 'api';
  }
  if (location.pathname.match(/^\/starfish\/database\//)) {
    return 'database';
  }
  return 'endpoint-overview';
}
