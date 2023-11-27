import {useMemo} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {RateUnits} from 'sentry/utils/discover/fields';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage, formatRate} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';

type RawDataRow<K extends string> = Record<K, any>;

type DurationDataRow<K extends string> = RawDataRow<K> & {
  durationAfter: number;
  durationBefore: number;
  percentageChange: number;
};

type ThroughputDataRow<K extends string> = RawDataRow<K> & {
  percentageChange: number;
  throughputAfter: number;
  throughputBefore: number;
};

interface EventRegressionTableProps<K extends string> {
  causeType: 'duration' | 'throughput';
  columns: GridColumnOrder<K>[];
  data: (DurationDataRow<K> | ThroughputDataRow<K>)[];
  isError: boolean;
  isLoading: boolean;
  options: Record<
    string,
    {
      defaultValue?: React.ReactNode;
      link?: (any) =>
        | {
            target: LocationDescriptor;
            onClick?: () => void;
          }
        | undefined;
    }
  >;
}

export function EventRegressionTable<K extends string>(
  props: EventRegressionTableProps<K>
) {
  const location = useLocation();

  const columnOrder = useMemo(() => {
    if (props.causeType === 'throughput') {
      return [
        ...props.columns,
        {key: 'throughputBefore', name: t('Baseline'), width: 150},
        {key: 'throughputAfter', name: t('Regressed'), width: 150},
        {key: 'percentageChange', name: t('Change'), width: 150},
      ];
    }
    return [
      ...props.columns,
      {key: 'durationBefore', name: t('Baseline'), width: 150},
      {key: 'durationAfter', name: t('Regressed'), width: 150},
      {key: 'percentageChange', name: t('Change'), width: 150},
    ];
  }, [props.causeType, props.columns]);

  const renderBodyCell = useMemo(
    () =>
      bodyCellRenderer(props.options, {
        throughputBefore: throughputRenderer,
        throughputAfter: throughputRenderer,
        durationBefore: durationRenderer,
        durationAfter: durationRenderer,
        percentageChange: changeRenderer,
      }),
    [props.options]
  );

  return (
    <GridEditable
      error={props.isError}
      isLoading={props.isLoading}
      data={props.data}
      location={location}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{renderHeadCell, renderBodyCell}}
    />
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set([
  'durationBefore',
  'durationAfter',
  'durationChange',
  'throughputBefore',
  'throughputAfter',
  'percentageChange',
]);

function renderHeadCell(column): React.ReactNode {
  return (
    <SortLink
      align={RIGHT_ALIGNED_COLUMNS.has(column.key) ? 'right' : 'left'}
      title={column.name}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function bodyCellRenderer(options, builtinRenderers) {
  return function renderGridBodyCell(
    column,
    dataRow,
    _rowIndex,
    _columnIndex
  ): React.ReactNode {
    const option = options[column.key];
    const renderer = option?.renderer || builtinRenderers[column.key] || defaultRenderer;
    return renderer(dataRow[column.key], {dataRow, option});
  };
}

function throughputRenderer(throughput, {dataRow, option}) {
  const rendered = formatRate(throughput, RateUnits.PER_MINUTE);
  return <NumberContainer>{wrap(rendered, dataRow, option)}</NumberContainer>;
}

function durationRenderer(duration, {dataRow, option}) {
  const rendered = <Duration seconds={duration} fixedDigits={2} abbreviation />;
  return <NumberContainer>{wrap(rendered, dataRow, option)}</NumberContainer>;
}

function changeRenderer(percentageChange) {
  return (
    <ChangeContainer
      change={
        percentageChange > 0 ? 'positive' : percentageChange < 0 ? 'negative' : 'neutral'
      }
    >
      {percentageChange > 0 ? '+' : ''}
      {formatPercentage(percentageChange)}
    </ChangeContainer>
  );
}

function defaultRenderer(value, {dataRow, option}) {
  return <Container>{wrap(value, dataRow, option)}</Container>;
}

function wrap(value, dataRow, option) {
  let rendered = value;
  if (defined(option)) {
    if (!defined(value) && defined(option.defaultValue)) {
      rendered = option.defaultValue;
    }
    if (defined(option.link)) {
      const link = option.link(dataRow);
      if (defined(link?.target)) {
        rendered = (
          <Link to={link.target} onClick={link.onClick}>
            {rendered}
          </Link>
        );
      }
    }
  }
  return rendered;
}

const ChangeContainer = styled(NumberContainer)<{
  change: 'positive' | 'neutral' | 'negative';
}>`
  ${p => p.change === 'positive' && `color: ${p.theme.red300};`}
  ${p => p.change === 'neutral' && `color: ${p.theme.gray300};`}
  ${p => p.change === 'negative' && `color: ${p.theme.green300};`}
`;
