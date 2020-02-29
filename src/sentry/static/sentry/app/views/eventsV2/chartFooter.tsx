import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import YAxisSelector from 'app/views/events/yAxisSelector';
import space from 'app/styles/space';

import {ChartControls, InlineContainer, SectionHeading} from './styles';

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
      <Value data-test-id="loading-placeholder" key="total-value">
        -
      </Value>
    ) : (
      <Value key="total-value">{total.toLocaleString()}</Value>
    )
  );

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
