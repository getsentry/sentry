import {t} from 'sentry/locale';
import type {SpanIndexedResponse} from 'sentry/views/insights/types';

export function CacheHitMissCell(props: {
  hit: SpanIndexedResponse['cache.hit'] | boolean;
}) {
  const {hit} = props;
  // TODO: remove hit === 'true' with `useInsightsEap`
  if (hit === 'true' || hit === true) {
    return <span>{t('HIT')}</span>;
  }
  if (hit === 'false' || hit === false) {
    return <span>{t('MISS')}</span>;
  }
  return <span>--</span>;
}
