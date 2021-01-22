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
};

function Rule({rule, onEditRule, onDeleteRule}: Props) {
  const {ty, condition, sampleRate} = rule;
  return (
    <React.Fragment>
      <Column>
        <IconGrabbable />
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
        <Actions onEditRule={onEditRule} onDeleteRule={onDeleteRule} disabled={false} />
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
