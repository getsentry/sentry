import type {Location} from 'history';
import moment from 'moment-timezone';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {URL_PARAM} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function getExploreShareUrl({
  datetime,
  location,
  now = new Date(),
}: {
  datetime: PageFilterDatetime;
  location: Location;
  now?: Date;
}): string {
  const url = new URL(location.pathname, window.location.origin);
  const params = new URLSearchParams(location.search);

  const hasAbsoluteRange = Boolean(datetime.start && datetime.end);
  const periodHours = datetime.period ? parsePeriodToHours(datetime.period) : -1;

  if (!hasAbsoluteRange && periodHours > 0) {
    const end = moment(now);
    const start = end.clone().subtract(periodHours, 'hours');
    params.delete(URL_PARAM.PERIOD);
    params.set(URL_PARAM.START, getUtcDateString(start));
    params.set(URL_PARAM.END, getUtcDateString(end));
  }

  url.search = params.toString();
  return url.toString();
}

type ExploreShareButtonProps = {
  traceItemDataset: TraceItemDataset;
  size?: ButtonProps['size'];
};

export function ExploreShareButton({
  traceItemDataset,
  size = 'xs',
}: ExploreShareButtonProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();
  const {copy} = useCopyToClipboard();

  return (
    <Button
      size={size}
      variant="secondary"
      icon={<IconUpload />}
      onClick={() => {
        copy(getExploreShareUrl({datetime: selection.datetime, location}), {
          successMessage: t('Link copied to clipboard'),
          errorMessage: t('Failed to copy link'),
        }).then(() => {
          trackAnalytics('explore.share_link_copied', {
            organization,
            traceItemDataset,
            frozen_relative_period: !selection.datetime.start && !selection.datetime.end,
          });
        });
      }}
      tooltipProps={{
        title: t('Copy a link to this view with the time range frozen.'),
      }}
    >
      {t('Share')}
    </Button>
  );
}
