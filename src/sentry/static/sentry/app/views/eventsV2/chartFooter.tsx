import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import Duration from 'app/components/duration';
import YAxisSelector from 'app/views/events/yAxisSelector';
import {getFormattedDate} from 'app/utils/dates';
import space from 'app/styles/space';

import {decodeColumnOrder} from './utils';
import {ChartControls, InlineContainer, SectionHeading} from './styles';

type TooltipSeries = {
  name: string;
  value: number;
};

export type TooltipData = {
  values: TooltipSeries[];
  timestamp: number;
};

type Props = {
  total: number | null;
  yAxisValue: string;
  yAxisOptions: SelectValue<string>[];
  onChange: (value: string) => void;
  hoverState: TooltipData;
};

function formatValue(val: string | number, columnName: string) {
  // Extract metadata from the columnName so we can format the
  // value appropriately.
  const columnData = decodeColumnOrder([{field: columnName}])[0];

  if (val === null || val === undefined) {
    return <Value>-</Value>;
  }

  if (columnData.type === 'duration' && typeof val === 'number') {
    return (
      <Value>
        <Duration seconds={val / 1000} fixedDigits={2} abbreviation />
      </Value>
    );
  }

  const formatted = typeof val === 'number' ? val.toLocaleString() : val;
  return <Value>{formatted}</Value>;
}

export default function ChartFooter({
  total,
  yAxisValue,
  yAxisOptions,
  hoverState,
  onChange,
}: Props) {
  const elements: React.ReactNode[] = [];
  if (hoverState.values.length === 0) {
    elements.push(<SectionHeading>{t('Total')}</SectionHeading>);
    elements.push(
      total === null ? <Value>-</Value> : <Value>{total.toLocaleString()}</Value>
    );
  } else {
    elements.push(<SectionHeading>{t('Time')}</SectionHeading>);
    elements.push(
      <Value>{getFormattedDate(hoverState.timestamp, 'MMM D, LTS', {local: true})}</Value>
    );
    hoverState.values.forEach(item => {
      elements.push(<SectionHeading>{item.name}</SectionHeading>);
      elements.push(formatValue(item.value, yAxisValue));
    });
  }

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <YAxisSelector selected={yAxisValue} options={yAxisOptions} onChange={onChange} />
    </ChartControls>
  );
}

const Value = styled('span')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
`;
