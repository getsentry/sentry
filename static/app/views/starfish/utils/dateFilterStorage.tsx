import {PageFilters} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import localStorage from 'sentry/utils/localStorage';

function getStarfishStorageKey(orgSlug) {
  return `starfish-selection:${orgSlug}`;
}

export function setStarfishDateFilterStorage(
  orgSlug: string,
  {start, end, period, utc}: Partial<PageFilters['datetime']>
) {
  localStorage.setItem(
    getStarfishStorageKey(orgSlug),
    JSON.stringify({
      start: start ? getUtcDateString(start) : null,
      end: end ? getUtcDateString(end) : null,
      period,
      utc,
    })
  );
}

export function getStarfishDateFilterStorage(orgSlug: string) {
  const storedItem = localStorage.getItem(getStarfishStorageKey(orgSlug));
  if (!storedItem) {
    return null;
  }

  return JSON.parse(storedItem);
}
