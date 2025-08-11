import {t} from 'sentry/locale';

import DateRangeQueryLimitFooter from 'getsentry/components/features/dateRangeQueryLimitFooter';

const DESCRIPTION = t('To query over longer time ranges, upgrade to Business');

const QUERY_LIMIT_REFERRER = 'explore-spans-query-limit-footer';

export default function ExploreDateRangeQueryLimitFooter() {
  return (
    <DateRangeQueryLimitFooter
      description={DESCRIPTION}
      source={QUERY_LIMIT_REFERRER}
      upsellDefaultSelection="explore-spans"
    />
  );
}
