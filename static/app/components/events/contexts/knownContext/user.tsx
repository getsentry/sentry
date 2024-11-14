import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils';

enum UserContextKeys {
  ID = 'id',
  EMAIL = 'email',
  USERNAME = 'username',
  IP_ADDRESS = 'ip_address',
  NAME = 'name',
  GEO = 'geo',
}

export interface UserContext {
  // Any custom keys users may set
  [key: string]: any;
  [UserContextKeys.ID]?: string;
  [UserContextKeys.EMAIL]?: string;
  [UserContextKeys.USERNAME]?: string;
  [UserContextKeys.IP_ADDRESS]?: string;
  [UserContextKeys.NAME]?: string;
  [UserContextKeys.GEO]?: Partial<Record<UserContextGeoKeys, string>>;
}

enum UserContextGeoKeys {
  CITY = 'city',
  COUNTRY_CODE = 'country_code',
  SUBDIVISION = 'subdivision',
  REGION = 'region',
}

const EMAIL_REGEX = /[^@]+@[^\.]+\..+/;

function formatGeo(geoData: UserContext['geo'] = {}): string | undefined {
  if (!geoData) {
    return undefined;
  }

  const geoStringArray: string[] = [];

  if (geoData.city) {
    geoStringArray.push(geoData.city);
  }

  if (geoData.subdivision) {
    geoStringArray.push(geoData.subdivision);
  }

  if (geoData.region) {
    geoStringArray.push(
      geoData.country_code
        ? `${geoData.region} (${geoData.country_code})`
        : geoData.region
    );
  }

  return geoStringArray.join(', ');
}

export function getUserContextData({
  data,
  meta,
}: {
  data: UserContext;
  meta?: Record<keyof UserContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case UserContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case UserContextKeys.USERNAME:
        return {
          key: ctxKey,
          subject: t('Username'),
          value: data.username,
        };
      case UserContextKeys.ID:
        return {
          key: ctxKey,
          subject: t('ID'),
          value: data.id,
        };
      case UserContextKeys.IP_ADDRESS:
        return {
          key: ctxKey,
          subject: t('IP Address'),
          value: data.ip_address,
        };
      case UserContextKeys.EMAIL:
        return {
          key: ctxKey,
          subject: t('Email'),
          value: data.email,
          action: {
            link:
              defined(data.email) && EMAIL_REGEX.test(data.email)
                ? `mailto:${data.email}`
                : undefined,
          },
        };
      case UserContextKeys.GEO:
        return {
          key: ctxKey,
          subject: t('Geography'),
          value: formatGeo(data.geo),
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
