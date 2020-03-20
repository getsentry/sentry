import React from 'react';

import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import YAxisSelector from 'app/views/events/yAxisSelector';

import {ChartControls, InlineContainer, SectionHeading, SectionValue} from './styles';

type Props = {
  total: number | null;
  yAxisValue: string;
  yAxisOptions: SelectValue<string>[];
  onChange: (value: string) => void;
};

export default function ChartFooter({total, yAxisValue, yAxisOptions, onChange}: Props) {
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Total')}</SectionHeading>);
  elements.push(
    total === null ? (
      <SectionValue data-test-id="loading-placeholder" key="total-value">
        -
      </SectionValue>
    ) : (
      <SectionValue key="total-value">{total.toLocaleString()}</SectionValue>
    )
  );

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <YAxisSelector selected={yAxisValue} options={yAxisOptions} onChange={onChange} />
    </ChartControls>
  );
}
