import React from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import styled from '@emotion/styled';

import {IconGrabbable} from 'app/icons/iconGrabbable';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import {layout} from '../utils';

import Actions from './actions';
import Conditions from './conditions';
import SampleRate from './sampleRate';
import Type from './type';

type Props = {
  rule: DynamicSamplingRule;
  onEditRule: () => void;
  onDeleteRule: () => void;
  disabled: boolean;
  listeners: DraggableSyntheticListeners;
  grabAttributes?: UseDraggableArguments['attributes'];
  grabStyle?: React.CSSProperties;
};

function Rule({
  rule,
  onEditRule,
  onDeleteRule,
  disabled,
  listeners,
  grabAttributes,
  grabStyle,
}: Props) {
  const {type, condition, sampleRate} = rule;

  return (
    <Columns>
      <Column>
        <IconGrabbableWrapper
          {...listeners}
          disabled={disabled}
          style={grabStyle}
          {...grabAttributes}
        >
          <IconGrabbable />
        </IconGrabbableWrapper>
      </Column>
      <Column>
        <Type type={type} />
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
    </Columns>
  );
}

export default Rule;

const Columns = styled('div')`
  cursor: default;
  display: grid;
  align-items: center;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
  ${p => layout(p.theme)}
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;

const IconGrabbableWrapper = styled('div')<{disabled: boolean}>`
  ${p => p.disabled && `color: ${p.theme.disabled}`};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'grab')};
  outline: none;
`;
