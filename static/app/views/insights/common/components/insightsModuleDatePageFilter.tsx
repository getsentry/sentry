import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {
  DatePageFilter,
  type DatePageFilterProps,
} from 'sentry/components/organizations/datePageFilter';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import {QUERY_DATE_RANGE_LIMIT} from 'sentry/views/insights/settings';

const DISABLED_OPTIONS = ['90d'];

export function InsightsModuleDatePageFilter() {
  const organization = useOrganization();

  const legacyDateFilterProps: DatePageFilterProps = useMemo(() => {
    const dateFilterProps: DatePageFilterProps = {};

    const hasDateRangeQueryLimit = organization.features.includes(
      'insights-query-date-range-limit'
    );

    if (hasDateRangeQueryLimit) {
      dateFilterProps.relativeOptions = ({arbitraryOptions}) => {
        return {
          ...arbitraryOptions,
          '1h': t('Last 1 hour'),
          '24h': t('Last 24 hours'),
          '7d': t('Last 7 days'),
          '14d': t('Last 14 days'),
          '30d': t('Last 30 days'),
          '90d': <DisabledDateOption value={t('Last 90 days')} />,
        };
      };

      dateFilterProps.maxPickableDays = QUERY_DATE_RANGE_LIMIT;
      dateFilterProps.isOptionDisabled = ({value}) => {
        if (!DISABLED_OPTIONS.includes(value)) {
          return false;
        }
        return true;
      };
      dateFilterProps.menuFooter = <UpsellFooterHook />;
    }

    return dateFilterProps;
  }, [organization]);

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  const props = organization.features.includes('downsampled-page-filter')
    ? datePageFilterProps
    : legacyDateFilterProps;

  return <DatePageFilter {...props} />;
}

function DisabledDateOption({value}: {value: string}) {
  return (
    <Flex align="center">
      {value}
      <StyledIconBuisness />
    </Flex>
  );
}

const StyledIconBuisness = styled(IconBusiness)`
  margin-left: auto;
`;

const UpsellFooterHook = HookOrDefault({
  hookName: 'component:insights-date-range-query-limit-footer',
  defaultComponent: () => undefined,
});
