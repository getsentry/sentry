import React from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'app/icons/iconGrabbable';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import Actions from './actions';
import Conditions from './conditions';
import SampleRate from './sampleRate';
import Type from './type';

type Props = {
  rule: DynamicSamplingRule;
  onEditRule: () => void;
  onDeleteRule: () => void;
  disabled: boolean;
};

function Rule({rule, onEditRule, onDeleteRule, disabled}: Props) {
  const {ty, condition, sampleRate} = rule;
  return (
    <React.Fragment>
      <Column>
        <StyledIconGrabbable disabled={disabled} />
      </Column>
      <Column>
        <Type type={ty} />
      </Column>
      <Column>
        <Conditions condition={condition} />
      </Column>
      <CenteredColumn>
        <SampleRate sampleRate={sampleRate} />
      </CenteredColumn>
      <Column>
        <Actions
          onEditRule={onEditRule}
          onDeleteRule={onDeleteRule}
          disabled={disabled}
        />
      </Column>
    </React.Fragment>
  );
}

export default Rule;

const Column = styled('div')`
  display: flex;
  align-items: center;
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

const StyledIconGrabbable = styled(IconGrabbable)<{disabled: boolean}>`
  ${p => p.disabled && `color: ${p.theme.disabled}`}
`;
