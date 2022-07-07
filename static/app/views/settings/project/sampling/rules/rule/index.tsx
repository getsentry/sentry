import {Fragment, useEffect, useState} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SamplingRule, SamplingRuleOperator} from 'sentry/types/sampling';

import {getInnerNameLabel} from '../../utils';
import {layout} from '../utils';

import {Actions} from './actions';
import {ConditionValue} from './conditionValue';

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
    <Columns disabled={rule.bottomPinned || noPermission}>
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
            containerDisplayMode="flex"
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
        <Conditions>
          {hideGrabButton && !rule.condition.inner.length
            ? t('All')
            : rule.condition.inner.map((condition, index) => (
                <Fragment key={index}>
                  <ConditionName>{getInnerNameLabel(condition.name)}</ConditionName>
                  <ConditionEqualOperator>{'='}</ConditionEqualOperator>
                  <ConditionValue value={condition.value} />
                </Fragment>
              ))}
        </Conditions>
      </Column>
      <RightColumn>
        <SampleRate>{`${rule.sampleRate * 100}\u0025`}</SampleRate>
      </RightColumn>
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
  padding: ${space(1)} ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
  /* match the height of edit and delete buttons */
  line-height: 34px;
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
  display: flex;
  align-items: center;
  /* match the height of edit and delete buttons */
  height: 34px;
`;

const GrabColumn = styled(Column)`
  [role='button'] {
    cursor: grab;
  }
`;

const Columns = styled('div')<{disabled: boolean}>`
  display: grid;
  align-items: flex-start;
  line-height: 34px;
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

const RightColumn = styled(Column)`
  text-align: right;
  justify-content: flex-end;
`;

const Conditions = styled('div')`
  display: grid;
  color: ${p => p.theme.purple300};
  align-items: flex-start;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: max-content max-content 1fr;
    grid-column-gap: ${space(1)};
  }
`;

const ConditionName = styled('div')`
  color: ${p => p.theme.gray400};
`;

const ConditionEqualOperator = styled('div')`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;
