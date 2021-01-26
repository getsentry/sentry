import React from 'react';
import {
  DraggableProvidedDraggableProps,
  DraggableProvidedDragHandleProps,
} from 'react-beautiful-dnd';
import styled from '@emotion/styled';

import {IconGrabbable} from 'app/icons/iconGrabbable';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import {layout} from '../utils';

import Actions from './actions';
import Conditions from './conditions';
import SampleRate from './sampleRate';
import Type from './type';

type Props = DraggableProvidedDraggableProps & {
  rule: DynamicSamplingRule;
  onEditRule: () => void;
  onDeleteRule: () => void;
  disabled: boolean;
  isDragging: boolean;
  dragHandle?: DraggableProvidedDragHandleProps;
};

type WrapperProps = Omit<
  Props,
  'rule' | 'onEditRule' | 'onDeleteRule' | 'disabled' | 'dragHandle'
>;

const Rule = React.forwardRef(function Rule(
  {rule, onEditRule, onDeleteRule, disabled, dragHandle, ...props}: Props,
  ref: React.Ref<HTMLDivElement>
) {
  const {ty, condition, sampleRate} = rule;

  return (
    <Wrapper {...props} ref={ref}>
      <Column>
        <IconGrabbableWrapper {...dragHandle} disabled={disabled}>
          <IconGrabbable />
        </IconGrabbableWrapper>
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
    </Wrapper>
  );
});

export default Rule;

const Wrapper = styled('div')<WrapperProps>`
  display: grid;
  align-items: center;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
  ${p => layout(p.theme)}
  ${p =>
    p.isDragging &&
    `
      background: ${p.theme.background};
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
      opacity: 0.8;
      border-radius: ${p.theme.borderRadius};
    `}
`;

const Column = styled('div')`
  padding: ${space(2)};
`;

const CenteredColumn = styled(Column)`
  text-align: center;
`;

const IconGrabbableWrapper = styled('div')<{disabled: boolean}>`
  ${p => p.disabled && `color: ${p.theme.disabled}`}
`;
