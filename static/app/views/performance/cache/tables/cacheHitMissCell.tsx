import {t} from 'sentry/locale';
import type {IndexedResponse} from 'sentry/views/starfish/types';

export function CacheHitMissCell(props: {hit: IndexedResponse['cache.hit']}) {
  const {hit} = props;
  if (hit === 'true') {
    return <span>{t('HIT')}</span>;
  }
  if (hit === 'false') {
    return <span>{t('MISS')}</span>;
  }
  return <span>--</span>;
}
