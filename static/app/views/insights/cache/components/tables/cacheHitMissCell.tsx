import {t} from 'sentry/locale';

// TODO: Ideally the hit prop is a boolean (SpanResponse['cache.hit'])
export function CacheHitMissCell(props: {hit: 'true' | 'false' | ''}) {
  const {hit} = props;
  if (hit === 'true') {
    return <span>{t('HIT')}</span>;
  }
  if (hit === 'false') {
    return <span>{t('MISS')}</span>;
  }
  return <span>--</span>;
}
