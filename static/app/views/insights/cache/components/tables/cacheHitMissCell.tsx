import {t} from 'sentry/locale';
import type {SpanIndexedResponse} from 'sentry/views/insights/types';

export function CacheHitMissCell(props: {hit: SpanIndexedResponse['cache.hit']}) {
  const {hit} = props;
  if (hit === 'true') {
    return <span>{t('HIT')}</span>;
  }
  if (hit === 'false') {
    return <span>{t('MISS')}</span>;
  }
  return <span>--</span>;
}
