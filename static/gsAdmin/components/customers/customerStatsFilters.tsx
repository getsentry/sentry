import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useRouter from 'sentry/utils/useRouter';

const ON_DEMAND_PERIOD_KEY = 'onDemand';

export enum DataType {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  INDEXED_TRANSACTIONS = 'indexed_transactions',
  REPLAYS = 'replays',
  FEEDBACK = 'feedback',
  PROFILES = 'profiles',
  INDEXED_PROFILES = 'indexed_profiles',
  MONITORS = 'monitors',
  SPANS = 'spans',
  INDEXED_SPANS = 'indexed_spans',
  PROFILE_DURATION = 'profile_duration',
  PROFILE_CHUNK = 'profile_chunk',
  PROFILE_CHUNK_UI = 'profile_chunk_ui',
  ATTACHMENTS = 'attachments',
}

const dataTypeLabels = {
  [DataType.ERRORS]: 'Errors',
  [DataType.TRANSACTIONS]: 'Transactions',
  [DataType.INDEXED_TRANSACTIONS]: 'Indexed Transactions',
  [DataType.PROFILES]: 'Profiles',
  [DataType.INDEXED_PROFILES]: 'Indexed Profiles',
  [DataType.PROFILE_DURATION]: 'Profile Hours',
  [DataType.PROFILE_CHUNK]: 'Profile Chunks',
  [DataType.PROFILE_CHUNK_UI]: 'Profile Chunks UI',
  [DataType.REPLAYS]: 'Replays',
  [DataType.FEEDBACK]: 'Feedback',
  [DataType.MONITORS]: 'Monitor Check-Ins',
  [DataType.SPANS]: 'Spans',
  [DataType.INDEXED_SPANS]: 'Indexed Spans',
  [DataType.ATTACHMENTS]: 'Attachments',
};

export function categoryFromDataType(dataType: DataType): string {
  switch (dataType) {
    case DataType.TRANSACTIONS:
      return 'transaction';
    case DataType.INDEXED_TRANSACTIONS:
      return 'transaction_indexed';
    case DataType.PROFILES:
      return 'profile';
    case DataType.INDEXED_PROFILES:
      return 'profile_indexed';
    case DataType.PROFILE_DURATION:
      return 'profile_duration';
    case DataType.PROFILE_CHUNK:
      return 'profile_chunk';
    case DataType.PROFILE_CHUNK_UI:
      return 'profile_chunk_ui';
    case DataType.REPLAYS:
      return 'replay';
    case DataType.FEEDBACK:
      return 'feedback';
    case DataType.MONITORS:
      return 'monitor';
    case DataType.SPANS:
      return 'span';
    case DataType.INDEXED_SPANS:
      return 'span_indexed';
    case DataType.ATTACHMENTS:
      return 'attachment';
    case DataType.ERRORS:
    default:
      return 'error';
  }
}

type Props = {
  dataType: DataType;
  onChange: (dataType: DataType) => void;
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

  const onDemandLabel = (
    <Fragment>
      On-Demand (
      <DateTime date={onDemandPeriodStart} /> - <DateTime date={onDemandPeriodEnd} />)
    </Fragment>
  );

  return (
    <Filters>
      <CompactSelect
        triggerProps={{prefix: 'Data Type'}}
        value={dataType}
        options={Object.entries(dataTypeLabels).map(([value, label]) => ({
          value,
          label,
        }))}
        onChange={opt => onChange(opt.value as DataType)}
      />
      <DateTimeRange
        triggerProps={{prefix: 'Date Range'}}
        triggerLabel={
          !period && !start && !end
            ? onDemand
              ? onDemandLabel
              : DEFAULT_RELATIVE_PERIODS['90d']
            : undefined
        }
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
    </Filters>
  );
}

const Filters = styled('div')`
  display: flex;
  width: 100%;
  margin-bottom: ${space(3)};
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const DateTimeRange = styled(TimeRangeSelector)`
  flex: 1;
  white-space: nowrap;
`;
