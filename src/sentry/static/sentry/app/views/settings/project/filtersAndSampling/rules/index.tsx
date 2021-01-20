import React from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import CenteredColumn from './centeredColumn';
import Rule from './rule';

type Props = {
  rules: Array<DynamicSamplingRule>;
};

function Rules({rules}: Props) {
  return (
    <StyledPanelTable
      headers={[
        '',
        t('Type'),
        <CenteredColumn key="projects">{t('Projects')}</CenteredColumn>,
        t('Condition'),
        <CenteredColumn key="sampling-rate">{t('Sampling Rate')}</CenteredColumn>,
        '',
      ]}
      isEmpty={!rules.length}
    >
      {rules.map((rule, index) => (
        <Rule key={index} rule={rule} />
      ))}
    </StyledPanelTable>
  );
}

export default Rules;

// TODO(Priscila): Add PanelTable footer prop
const StyledPanelTable = styled(PanelTable)`
  margin-bottom: 0;
  border: none;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  grid-template-columns: max-content max-content 1fr 1.5fr 0.5fr max-content;
  > *:nth-child(-n + 6) {
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;
