import {Location} from 'history';

import {t} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';

type ColorEncoding =
  | 'version' // this will use a concatenation of `app_version_name` and `app_version`
  | 'device_manufacturer'
  | 'device_model'
  | 'device_os_version'
  | 'transaction_name';

const COLOR_ENCODING_LABELS: Record<ColorEncoding, string> = {
  version: t('App Version'),
  device_manufacturer: t('Device Manufacturer'),
  device_model: t('Device Model'),
  device_os_version: t('Device Os Version'),
  transaction_name: t('Transaction Name'),
};

export const COLOR_ENCODINGS: SelectValue<ColorEncoding>[] = Object.entries(
  COLOR_ENCODING_LABELS
).map(([value, label]) => ({label, value: value as ColorEncoding}));

export function getColorEncodingFromLocation(location: Location): ColorEncoding {
  const colorCoding = decodeScalar(location.query.colorEncoding);

  if (defined(colorCoding) && COLOR_ENCODING_LABELS.hasOwnProperty(colorCoding)) {
    return colorCoding as ColorEncoding;
  }

  return 'transaction_name';
}
