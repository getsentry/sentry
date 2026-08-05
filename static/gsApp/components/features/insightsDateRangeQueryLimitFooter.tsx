import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import DateRangeQueryLimitFooter from 'getsentry/components/features/dateRangeQueryLimitFooter';

const DESCRIPTION = t(
  'To view more trends for your Performance data, upgrade to Business.'
);

const QUERY_LIMIT_REFERRER = 'insights-query-limit-footer';

export function InsightsDateRangeQueryLimitFooter() {
  const organization = useOrganization();

  if (!organization.features.includes('insights-query-date-range-limit')) {
    return null;
  }

  return (
    <DateRangeQueryLimitFooter description={DESCRIPTION} source={QUERY_LIMIT_REFERRER} />
  );
}
