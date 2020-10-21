import * as React from 'react';

import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import OptionSelector from 'app/components/charts/optionSelector';

type Props = {
  total: number | null;
  yAxisValue: string;
  yAxisOptions: SelectValue<string>[];
  onAxisChange: (value: string) => void;
  displayMode: string;
  displayOptions: SelectValue<string>[];
  onDisplayChange: (value: string) => void;
};

export default function ChartFooter({
  total,
  yAxisValue,
  yAxisOptions,
  onAxisChange,
  displayMode,
  displayOptions,
  onDisplayChange,
}: Props) {
  const elements: React.ReactNode[] = [];

  elements.push(<SectionHeading key="total-label">{t('Total Events')}</SectionHeading>);
  elements.push(
    total === null ? (
      <SectionValue data-test-id="loading-placeholder" key="total-value">
        &mdash;
      </SectionValue>
    ) : (
      <SectionValue key="total-value">{total.toLocaleString()}</SectionValue>
    )
  );

  return (
    <ChartControls>
      <InlineContainer>{elements}</InlineContainer>
      <InlineContainer>
        <OptionSelector
          title={t('Display')}
          selected={displayMode}
          options={displayOptions}
          onChange={onDisplayChange}
          menuWidth="170px"
        />
        <OptionSelector
          title={t('Y-Axis')}
          selected={yAxisValue}
          options={yAxisOptions}
          onChange={onAxisChange}
        />
      </InlineContainer>
    </ChartControls>
  );
}
