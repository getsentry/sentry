import React from 'react';

import {IconGrabbable} from 'app/icons/iconGrabbable';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import CenteredColumn from '../centeredColumn';
import Column from '../column';

import Actions from './actions';
import Conditions from './conditions';
import Projects from './projects';
import Type from './type';

type Props = {
  rule: DynamicSamplingRule;
};

function Rule({rule}: Props) {
  const {ty, projectIds, conditions, sampleRate} = rule;
  return (
    <React.Fragment>
      <Column>
        <IconGrabbable />
      </Column>
      <Column>
        <Type type={ty} />
      </Column>
      <CenteredColumn>
        <Projects projectIds={projectIds} />
      </CenteredColumn>
      <Column>
        <Conditions conditions={conditions} />
      </Column>
      <CenteredColumn>{`${sampleRate}\u0025`}</CenteredColumn>
      <Column>
        <Actions onEditRule={() => {}} onDeleteRule={() => {}} disabled={false} />
      </Column>
    </React.Fragment>
  );
}

export default Rule;
