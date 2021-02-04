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
  rootStyle?: React.CSSProperties;
  grabStyle?: React.CSSProperties;
  forwardRef?: React.Ref<HTMLDivElement>;
};

function Rule({
  rule,
  onEditRule,
  onDeleteRule,
  disabled,
  listeners,
  grabAttributes,
  rootStyle,
  forwardRef,
  grabStyle,
}: Props) {
  const {type, condition, sampleRate} = rule;

  return (
    <Wrapper ref={forwardRef} style={rootStyle}>
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
    </Wrapper>
  );
}

export default Rule;

const boxShadowBorder = '0 0 0 calc(1px / var(--scale-x, 1)) rgba(63, 63, 68, 0.05)';
const boxShadowCommon = '0 1px calc(3px / var(--scale-x, 1)) 0 rgba(34, 33, 81, 0.15)';
const boxShadow = `${boxShadowBorder}, ${boxShadowCommon}`;

const Wrapper = styled('div')`
  transform: translate3d(var(--translate-x, 0), var(--translate-y, 0), 0)
    scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1));
  transform-origin: 0 0;
  touch-action: manipulation;
  --box-shadow: ${boxShadow};
  --box-shadow-picked-up: ${boxShadowBorder}, -1px 0 15px 0 rgba(34, 33, 81, 0.01),
    0px 15px 15px 0 rgba(34, 33, 81, 0.25);
`;

const Columns = styled('div')`
  display: grid;
  align-items: center;
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
  ${p => layout(p.theme)}

  cursor: default;
  position: relative;
  background-color: ${p => p.theme.white};
  -webkit-tap-highlight-color: transparent;
  transition: box-shadow 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);

  animation: pop 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);
  box-shadow: var(--box-shadow-picked-up);
  opacity: 1;

  :focus {
    box-shadow: 0 0px 4px 1px rgba(76, 159, 254, 1), ${boxShadow};
  }

  @keyframes pop {
    0% {
      transform: scale(1);
      box-shadow: var(--box-shadow);
    }
    100% {
      box-shadow: var(--box-shadow-picked-up);
    }
  }
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
  cursor: grab;
`;
