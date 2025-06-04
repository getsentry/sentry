import {t} from 'sentry/locale';
import type {EAPSpanResponse, SpanIndexedResponse} from 'sentry/views/insights/types';

export function CacheHitMissCell(props: {
  hit: SpanIndexedResponse['cache.hit'] | EAPSpanResponse['cache.hit'];
}) {
  const {hit} = props;
  if (hit === 'true' || hit === true) {
    return <span>{t('HIT')}</span>;
  }
  if (hit === 'false' || hit === false) {
    return <span>{t('MISS')}</span>;
  }
  return <span>--</span>;
}
