import {Location} from 'history';

import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';

type ColorEncoding =
  | 'app_version'
  | 'device_manufacturer'
  | 'device_model'
  | 'device_os_version'
  | 'interaction_name'
  | 'android_api_level';

const COLOR_ENCODING_LABELS: Record<ColorEncoding, string> = {
  app_version: t('App Version'),
  device_manufacturer: t('Device Manufacturer'),
  device_model: t('Device Model'),
  device_os_version: t('Device Os Version'),
  interaction_name: t('Interaction Name'),
  android_api_level: t('Android Api Level'),
};

export const COLOR_ENCODINGS: SelectValue<ColorEncoding>[] = Object.entries(
  COLOR_ENCODING_LABELS
).map(([value, label]) => ({label, value: value as ColorEncoding}));

export function getColorEncodingFromLocation(location: Location): ColorEncoding {
  const colorCoding = decodeScalar(location.query.colorEncoding);

  if (defined(colorCoding) && COLOR_ENCODING_LABELS.hasOwnProperty(colorCoding)) {
    return colorCoding as ColorEncoding;
  }

  return 'interaction_name';
}
