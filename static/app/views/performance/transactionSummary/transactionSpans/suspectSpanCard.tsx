import {useReducer} from 'react';
import {Location} from 'history';

import Button from 'sentry/components/button';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {formatFloat, formatPercentage} from 'sentry/utils/formatters';
import {SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';

import {PerformanceDuration} from '../../utils';

import SpanTable from './spanTable';
import {
  emptyValue,
  FooterPanel,
  HeaderItem,
  LowerPanel,
  SpanLabelContainer,
  UpperPanel,
} from './styles';
import {
  SpanSortOption,
  SpanSortOthers,
  SpanSortPercentiles,
  SpansTotalValues,
} from './types';
import {getSuspectSpanSortFromEventView} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  suspectSpan: SuspectSpan;
  transactionName: string;
  eventView: EventView;
  totals: SpansTotalValues | null;
  preview: number;
  project?: Project;
};

export default function SuspectSpanEntry(props: Props) {
  const {
    location,
    organization,
    suspectSpan,
    transactionName,
    eventView,
    totals,
    preview,
    project,
  } = props;

  const expandable = suspectSpan.examples.length > preview;

  const [collapsed, toggleCollapsed] = useReducer(state => !state, true);

  const visibileExamples = collapsed
    ? suspectSpan.examples.slice(0, preview)
    : suspectSpan.examples;

  const sort = getSuspectSpanSortFromEventView(eventView);

  return (
    <div data-test-id="suspect-card">
      <UpperPanel data-test-id="suspect-card-upper">
        <HeaderItem
          label={t('Span Operation')}
          value={<SpanLabel span={suspectSpan} />}
          align="left"
        />
        <PercentileDuration sort={sort} suspectSpan={suspectSpan} totals={totals} />
        <SpanCount sort={sort} suspectSpan={suspectSpan} totals={totals} />
        <TotalCumulativeDuration sort={sort} suspectSpan={suspectSpan} totals={totals} />
      </UpperPanel>
      <LowerPanel expandable={expandable} data-test-id="suspect-card-lower">
        <SpanTable
          isLoading={false}
          location={location}
          organization={organization}
          project={project}
          suspectSpan={suspectSpan}
          transactionName={transactionName}
          examples={visibileExamples}
        />
      </LowerPanel>
      {expandable && (
        <FooterPanel>
          <Button priority="link" onClick={toggleCollapsed}>
            {collapsed
              ? t('Show More Transaction Examples')
              : t('Hide Transaction Examples')}
          </Button>
        </FooterPanel>
      )}
    </div>
  );
}

type HeaderItemProps = {
  sort: SpanSortOption;
  suspectSpan: SuspectSpan;
  totals: SpansTotalValues | null;
};

const PERCENTILE_LABELS: Record<SpanSortPercentiles, string> = {
  [SpanSortPercentiles.P50_EXCLUSIVE_TIME]: t('p50 Exclusive Time'),
  [SpanSortPercentiles.P75_EXCLUSIVE_TIME]: t('p75 Exclusive Time'),
  [SpanSortPercentiles.P95_EXCLUSIVE_TIME]: t('p95 Exclusive Time'),
  [SpanSortPercentiles.P99_EXCLUSIVE_TIME]: t('p99 Exclusive Time'),
};

function PercentileDuration(props: HeaderItemProps) {
  const {sort, suspectSpan} = props;

  const sortKey = PERCENTILE_LABELS.hasOwnProperty(sort.field)
    ? sort.field
    : SpanSortPercentiles.P75_EXCLUSIVE_TIME;

  return (
    <HeaderItem
      label={PERCENTILE_LABELS[sortKey]}
      value={<PerformanceDuration abbreviation milliseconds={suspectSpan[sortKey]} />}
      align="right"
      isSortKey={sort.field === sortKey}
    />
  );
}

function SpanCount(props: HeaderItemProps) {
  const {sort, suspectSpan, totals} = props;

  if (sort.field === SpanSortOthers.COUNT) {
    return (
      <HeaderItem
        label={t('Total Count')}
        value={String(suspectSpan.count)}
        align="right"
        isSortKey
      />
    );
  }

  if (sort.field === SpanSortOthers.AVG_OCCURRENCE) {
    const {avgOccurrences} = suspectSpan;
    return (
      <HeaderItem
        label={t('Average Count')}
        value={defined(avgOccurrences) ? formatFloat(avgOccurrences, 2) : '\u2014'}
        align="right"
        isSortKey
      />
    );
  }

  let {frequency} = suspectSpan;
  if (!defined(frequency)) {
    return <HeaderItem label={t('Frequency')} value={'\u2014'} align="right" />;
  }

  // Because the frequency is computed using `count_unique(id)` internally,
  // it is an approximate value. This means that it has the potential to be
  // greater than `totals.count` when it shouldn't. So let's clip the
  // frequency value to make sure we don't see values over 100%.
  frequency = defined(totals?.count) ? Math.min(frequency, totals!.count) : frequency;

  const value = defined(totals?.count) ? (
    <Tooltip
      title={tct('[frequency] out of [total] transactions contain this span', {
        frequency,
        total: totals!.count,
      })}
    >
      <span>{formatPercentage(frequency / totals!.count)}</span>
    </Tooltip>
  ) : (
    String(suspectSpan.count)
  );

  return <HeaderItem label={t('Frequency')} value={value} align="right" />;
}

function TotalCumulativeDuration(props: HeaderItemProps) {
  const {sort, suspectSpan, totals} = props;

  const {sumExclusiveTime} = suspectSpan;
  if (!defined(sumExclusiveTime)) {
    return (
      <HeaderItem
        label={t('Total Exclusive Time')}
        value={'\u2014'}
        align="right"
        isSortKey={sort.field === SpanSortOthers.SUM_EXCLUSIVE_TIME}
      />
    );
  }

  let value = <PerformanceDuration abbreviation milliseconds={sumExclusiveTime} />;

  if (defined(totals?.sum_transaction_duration)) {
    value = (
      <Tooltip
        title={tct('[percentage] of the total transaction duration of [duration]', {
          percentage: formatPercentage(
            sumExclusiveTime / totals!.sum_transaction_duration
          ),
          duration: (
            <PerformanceDuration
              abbreviation
              milliseconds={totals!.sum_transaction_duration}
            />
          ),
        })}
      >
        {value}
      </Tooltip>
    );
  }

  return (
    <HeaderItem
      label={t('Total Exclusive Time')}
      value={value}
      align="right"
      isSortKey={sort.field === SpanSortOthers.SUM_EXCLUSIVE_TIME}
    />
  );
}

type SpanLabelProps = {
  span: SuspectSpan;
};

function SpanLabel(props: SpanLabelProps) {
  const {span} = props;

  const example = span.examples.find(ex => defined(ex.description));

  return (
    <Tooltip title={`${span.op} - ${example?.description ?? t('n/a')}`}>
      <SpanLabelContainer>
        <span>{span.op}</span> - {example?.description ?? emptyValue}
      </SpanLabelContainer>
    </Tooltip>
  );
}
