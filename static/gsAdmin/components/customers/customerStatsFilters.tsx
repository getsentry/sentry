import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {DATA_CATEGORY_INFO, DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useRouter from 'sentry/utils/useRouter';

const ON_DEMAND_PERIOD_KEY = 'onDemand';

type Props = {
  dataType: DataCategoryExact;
  onChange: (dataType: DataCategoryExact) => void;
  organization: Organization;
  onDemandPeriodEnd?: string;
  onDemandPeriodStart?: string;
};

export function CustomerStatsFilters({
  dataType,
  onChange,
  onDemandPeriodStart,
  onDemandPeriodEnd,
}: Props) {
  const router = useRouter();
  const onDemand = !!onDemandPeriodStart && !!onDemandPeriodEnd;

  const pageDateTime = useMemo((): DateTimeObject => {
    const query = router.location.query;

    const {start, end, statsPeriod} = normalizeDateTimeParams(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true,
    });

    if (statsPeriod) {
      return {period: statsPeriod};
    }

    if (start && end) {
      return {
        start: moment.utc(start).format(),
        end: moment.utc(end).format(),
      };
    }

    return {};
  }, [router.location.query]);

  const handleDateChange = useCallback(
    (datetime: ChangeData) => {
      const {start, end, relative, utc} = datetime;

      if (start && end) {
        const parser = utc ? moment.utc : moment;

        router.push({
          ...location,
          query: {
            ...router.location.query,
            statsPeriod: undefined,
            start: parser(start).format(),
            end: parser(end).format(),
            utc: utc ?? undefined,
          },
        });
        return;
      }

      router.push({
        ...location,
        query: {
          ...router.location.query,
          statsPeriod: relative === ON_DEMAND_PERIOD_KEY ? undefined : relative,
          start: undefined,
          end: undefined,
          utc: undefined,
        },
      });
    },
    [router]
  );

  const {start, end, period, utc} = pageDateTime;

  // TODO(billing): Should we start calling On-Demand periods "Pay-as-you-go" periods?
  const onDemandLabel = (
    <Fragment>
      On-Demand (
      <DateTime date={onDemandPeriodStart} /> - <DateTime date={onDemandPeriodEnd} />)
    </Fragment>
  );

  return (
    <Flex wrap="wrap" marginBottom="2xl" gap="xl" width="100%">
      <CompactSelect
        triggerProps={{prefix: 'Data Type'}}
        value={dataType}
        options={Object.entries(DATA_CATEGORY_INFO)
          .filter(([_, categoryInfo]) => categoryInfo.statsInfo.showInternalStats)
          .map(([category, categoryInfo]) => ({
            value: categoryInfo.name,
            label:
              category === DataCategoryExact.SPAN
                ? 'Accepted Spans'
                : categoryInfo.titleName,
          }))}
        onChange={opt => onChange(opt.value)}
      />
      <DateTimeRange
        triggerProps={{
          prefix: 'Date Range',
          children:
            !period && !start && !end
              ? onDemand
                ? onDemandLabel
                : DEFAULT_RELATIVE_PERIODS['90d']
              : undefined,
        }}
        relative={period ?? ''}
        start={start ?? null}
        end={end ?? null}
        utc={utc ?? null}
        onChange={handleDateChange}
        relativeOptions={({defaultOptions, arbitraryOptions}) =>
          onDemand
            ? {
                [ON_DEMAND_PERIOD_KEY]: onDemandLabel,
                ...defaultOptions,
                ...arbitraryOptions,
              }
            : {...defaultOptions, ...arbitraryOptions}
        }
        defaultPeriod={onDemand ? ON_DEMAND_PERIOD_KEY : '90d'}
        defaultAbsolute={
          onDemand
            ? {
                start: moment(onDemandPeriodStart).toDate(),
                end: moment(onDemandPeriodEnd).toDate(),
              }
            : undefined
        }
      />
    </Flex>
  );
}

const DateTimeRange = styled(TimeRangeSelector)`
  flex: 1;
  white-space: nowrap;
`;
