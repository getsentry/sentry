import {t} from 'sentry/locale';

export const ALERTS = {
  spm: {
    aggregate: 'spm()',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
  },
  decodedSize: {
    aggregate: 'avg(d:spans/http.decoded_response_content_length@byte)',
    name: t('Create Decoded Size Alert'),
  },
  transferSize: {
    aggregate: 'avg(d:spans/http.response_transfer_size@byte)',
    name: t('Create Transfer Size Alert'),
  },
  encodedSize: {
    aggregate: 'avg(d:spans/http.response_content_length@byte)',
    name: t('Create Encoded Size Alert'),
  },
};
