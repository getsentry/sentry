import {getFullUrl} from 'sentry/components/events/interfaces/utils';
import {EntryRequest, EntryType, Event} from 'sentry/types/event';
import {isUrl} from 'sentry/utils';

function getUrlFromEvent(event: Event): string {
  const requestEntry = event.entries.find(
    entry => entry.type === EntryType.REQUEST
  ) as EntryRequest;

  if (requestEntry) {
    const {data} = requestEntry;
    const isPartial =
      // We assume we only have a partial interface is we're missing
      // an HTTP method. This means we don't have enough information
      // to reliably construct a full HTTP request.
      !data.method || !data.url;

    let fullUrl = getFullUrl(data);

    if (!isUrl(fullUrl)) {
      // Check if the url passed in is a safe url to avoid XSS
      fullUrl = undefined;
    }

    if (fullUrl && !isPartial) {
      return fullUrl;
    }
  }

  return '';
}

export default getUrlFromEvent;
