import React from 'react';

import {t} from 'app/locale';
import {SelectValue} from 'app/types';
import Count from 'app/components/count';
import YAxisSelector from 'app/views/events/yAxisSelector';

import {ChartControls, InlineContainer, SectionHeading} from './styles';

type Props = {
  total: number | null;
  yAxisValue: string;
  yAxisOptions: SelectValue<string>[];
  onChange: (value: string) => void;
};

export default function ChartFooter({total, yAxisValue, yAxisOptions, onChange}: Props) {
  return (
    <ChartControls>
      <InlineContainer>
        <SectionHeading>{t('Count')}</SectionHeading>
        {total === null ? '-' : <Count value={Number(total)} />}
      </InlineContainer>
      <YAxisSelector selected={yAxisValue} options={yAxisOptions} onChange={onChange} />
    </ChartControls>
  );
}
