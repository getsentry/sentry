import type {Location} from 'history';

import {Button} from '@sentry/scraps/button';

import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAbsoluteRangeFromPeriod} from 'sentry/utils/duration/getAbsoluteRangeFromPeriod';
import {getPageUrlWithParams} from 'sentry/utils/url/getPageUrlWithParams';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function getExploreShareLink({
  datetime,
  location,
  now = Date.now(),
}: {
  datetime: PageFilterDatetime;
  location: Location;
  now?: number;
}): {frozenRelativePeriod: boolean; url: string} {
  const hasAbsoluteRange = Boolean(datetime.start && datetime.end);
  const range =
    !hasAbsoluteRange && datetime.period
      ? getAbsoluteRangeFromPeriod(datetime.period, now)
      : null;

  const url = getPageUrlWithParams(location, params => {
    if (!range) {
      return;
    }
    for (const key of DATE_TIME_KEYS) {
      if (key !== URL_PARAM.UTC) {
        params.delete(key);
      }
    }
    params.set(URL_PARAM.START, getUtcDateString(range.start));
    params.set(URL_PARAM.END, getUtcDateString(range.end));
  });

  return {url, frozenRelativePeriod: range !== null};
}

type ExploreShareButtonProps = {
  traceItemDataset: TraceItemDataset;
};

export function ExploreShareButton({traceItemDataset}: ExploreShareButtonProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();
  const {copy} = useCopyToClipboard();

  return (
    <Button
      size="xs"
      variant="secondary"
      icon={<IconUpload />}
      onClick={() => {
        const {url, frozenRelativePeriod} = getExploreShareLink({
          datetime: selection.datetime,
          location,
        });
        copy(url, {
          successMessage: t('Link copied to clipboard'),
          errorMessage: t('Failed to copy link'),
        }).then(copied => {
          if (copied) {
            trackAnalytics('explore.share_link_copied', {
              organization,
              traceItemDataset,
              frozen_relative_period: frozenRelativePeriod,
            });
          }
        });
      }}
      tooltipProps={{
        title: t('Copy a link to this view with the current time range.'),
      }}
    >
      {t('Share')}
    </Button>
  );
}
