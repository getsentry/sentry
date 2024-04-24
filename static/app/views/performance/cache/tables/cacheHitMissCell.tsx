import type {IndexedResponse} from 'sentry/views/starfish/types';

function CacheHitMissCell(props: {hit: IndexedResponse['cache.hit']}) {
  const {hit} = props;
  if (hit === 'true') {
    return <span>HIT</span>;
  }
  if (hit === 'false') {
    return <span>MISS</span>;
  }
  return <span>Unknown</span>;
}

export default CacheHitMissCell;
