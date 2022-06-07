import {useEffect, useState} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SamplingRule, SamplingRuleOperator} from 'sentry/types/sampling';

import {layout} from '../utils';

import {Actions} from './actions';
import {Conditions} from './conditions';

type Props = {
  dragging: boolean;
  /**
   * Hide the grab button if true.
   * This is used when the list has a single item, making sorting not possible.
   */
  hideGrabButton: boolean;
  listeners: DraggableSyntheticListeners;
  noPermission: boolean;
  onDeleteRule: () => void;
  onEditRule: () => void;
  operator: SamplingRuleOperator;
  rule: SamplingRule;
  sorting: boolean;
  grabAttributes?: UseDraggableArguments['attributes'];
};

type State = {
  isMenuActionsOpen: boolean;
};

export function Rule({
  dragging,
  sorting,
  rule,
  noPermission,
  onEditRule,
  onDeleteRule,
  listeners,
  operator,
  grabAttributes,
  hideGrabButton,
}: Props) {
  const [state, setState] = useState<State>({isMenuActionsOpen: false});

  useEffect(() => {
    if ((dragging || sorting) && state.isMenuActionsOpen) {
      setState({isMenuActionsOpen: false});
    }
  }, [dragging, sorting, state.isMenuActionsOpen]);

  return (
    <Columns disabled={rule.disabled || noPermission}>
      {hideGrabButton ? (
        <Column />
      ) : (
        <GrabColumn>
          <Tooltip
            title={
              noPermission
                ? t('You do not have permission to reorder rules.')
                : operator === SamplingRuleOperator.ELSE
                ? t('Rules without conditions cannot be reordered.')
                : undefined
            }
          >
            <IconGrabbableWrapper {...listeners} {...grabAttributes}>
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        </GrabColumn>
      )}

      <Column>
        <Operator>
          {operator === SamplingRuleOperator.IF
            ? t('If')
            : operator === SamplingRuleOperator.ELSE_IF
            ? t('Else if')
            : t('Else')}
        </Operator>
      </Column>
      <Column>
        <Conditions condition={rule.condition} />
      </Column>
      <CenteredColumn>
        <SampleRate>{`${rule.sampleRate * 100}\u0025`}</SampleRate>
      </CenteredColumn>
      <Column>
        <Actions
          onEditRule={onEditRule}
          onDeleteRule={onDeleteRule}
          disabled={noPermission}
          onOpenMenuActions={() =>
            setState({isMenuActionsOpen: !state.isMenuActionsOpen})
          }
          isMenuActionsOpen={state.isMenuActionsOpen}
        />
      </Column>
    </Columns>
  );
}

const Operator = styled('div')`
  color: ${p => p.theme.active};
`;

const SampleRate = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

const GrabColumn = styled(Column)`
  [role='button'] {
    cursor: grab;
  }
`;

const Columns = styled('div')<{disabled: boolean}>`
  display: grid;
  align-items: center;
  ${p => layout(p.theme)}
  > * {
    overflow: visible;
    :nth-child(5n) {
      justify-content: flex-end;
    }
  }

  ${p =>
    p.disabled &&
    css`
      ${GrabColumn} {
        color: ${p.theme.disabled};
        [role='button'] {
          cursor: not-allowed;
        }
      }
    `}
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
`;

const CenteredColumn = styled(Column)`
  text-align: center;
  justify-content: center;
`;
