import React from 'react';

import {t} from 'app/locale';

import {ChartControls, SectionHeading} from './styles';

type Props = {
  totals: number | null;
};

export default function ChartFooter({totals}: Props) {
  return (
    <ChartControls>
      <SectionHeading>
        {t('Total Events')}
        {totals}
      </SectionHeading>
    </ChartControls>
  );
}
