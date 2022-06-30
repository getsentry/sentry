import {Fragment, useEffect, useState} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import styled from '@emotion/styled';
import {css} from '@emotion/react';
import NewBooleanField from 'sentry/components/forms/booleanField';
import Tooltip from 'sentry/components/tooltip';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SamplingRule, SamplingRuleOperator, LegacyBrowser} from 'sentry/types/sampling';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';

import DropdownLink from 'sentry/components/dropdownLink';
import {IconDownload, IconEllipsis} from 'sentry/icons';

import {getInnerNameLabel, LEGACY_BROWSER_LIST} from './utils';

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
    <Fragment>
      <GrabColumn disabled={rule.bottomPinned || noPermission}>
        {hideGrabButton ? null : (
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
            <IconGrabbableWrapper {...listeners} {...grabAttributes} aria-label={dragging ? t('Drop Rule') : t('Drag Rule')}>
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        )}
      </GrabColumn>
      <OperatorColumn>
        <Operator>
          {operator === SamplingRuleOperator.IF
            ? t('If')
            : operator === SamplingRuleOperator.ELSE_IF
            ? t('Else if')
            : t('Else')}
        </Operator>
      </OperatorColumn>
      <ConditionColumn>
        {hideGrabButton && !rule.condition.inner.length
          ? t('All')
          : rule.condition.inner.map((condition, index) => (
              <Fragment key={index}>
                <ConditionName>{getInnerNameLabel(condition.name)}</ConditionName>
                <ConditionEqualOperator>{'='}</ConditionEqualOperator>
                {Array.isArray(condition.value) ? (
                  <div>
                    {[...condition.value].map((v, index) => (
                      <Fragment key={v}>
                        <ConditionValue>
                          {LEGACY_BROWSER_LIST[v]?.title ?? v}
                        </ConditionValue>
                        {index !== (condition.value as LegacyBrowser[]).length - 1 && (
                          <ConditionSeparator>{'\u002C'}</ConditionSeparator>
                        )}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <ConditionValue>
                    {LEGACY_BROWSER_LIST[String(condition.value)]?.title ??
                      String(condition.value)}
                  </ConditionValue>
                )}
              </Fragment>
            ))}
      </ConditionColumn>
      <RateColumn>
        <SampleRate>{`${rule.sampleRate * 100}\u0025`}</SampleRate>
      </RateColumn>
      <ActiveColumn>
        <ActiveToggle
          inline={false}
          hideControlState
          aria-label={rule.active ? t('Deactivate Rule') : t('Activate Rule')}
          name="active"
        />
      </ActiveColumn>
      <Column>
        <EllipisDropDownButton
          caret={false}
          customTitle={
            <Button
              aria-label={t('Actions')}
              icon={<IconEllipsis />}
              size="small"
              onClick={() => {
                setState({isMenuActionsOpen: !state.isMenuActionsOpen});
              }}
            />
          }
          isOpen={state.isMenuActionsOpen}
          anchorRight
        >
          <MenuItemActionLink
            shouldConfirm={false}
            icon={<IconDownload size="xs" />}
            title={t('Edit')}
            onClick={
              !noPermission
                ? onEditRule
                : event => {
                    event?.stopPropagation();
                  }
            }
            disabled={noPermission}
          >
            <Tooltip
              disabled={!noPermission}
              title={t('You do not have permission to edit sampling rules.')}
              containerDisplayMode="block"
            >
              {t('Edit')}
            </Tooltip>
          </MenuItemActionLink>
          <MenuItemActionLink
            onAction={onDeleteRule}
            message={t('Are you sure you wish to delete this sampling rule?')}
            icon={<IconDownload size="xs" />}
            title={t('Delete')}
            disabled={noPermission}
            priority="danger"
            shouldConfirm
          >
            <Tooltip
              disabled={!noPermission}
              title={t('You do not have permission to delete sampling rules.')}
              containerDisplayMode="block"
            >
              {t('Delete')}
            </Tooltip>
          </MenuItemActionLink>
        </EllipisDropDownButton>
      </Column>
    </Fragment>
  );
}

export const Column = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  cursor: default;
  white-space: pre-wrap;
  word-break: break-all;
`;

export const GrabColumn = styled(Column)<{disabled?: boolean}>`
  [role='button'] {
    cursor: grab;
  }

  ${p =>
    p.disabled &&
    css`
      [role='button'] {
        cursor: not-allowed;
      }
      color: ${p.theme.disabled};
    `}

  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

export const OperatorColumn = styled(Column)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

export const ConditionColumn = styled(Column)`
  display: flex;
  gap: ${space(1)};
  align-items: flex-start;
  flex-wrap: wrap;
`;

export const RateColumn = styled(Column)`
  justify-content: flex-end;
  text-align: right;
`;

export const ActiveColumn = styled(Column)`
  justify-content: center;
  text-align: center;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }
`;

const IconGrabbableWrapper = styled('div')`
  outline: none;
  display: flex;
  align-items: center;
  /* match the height of edit and delete buttons */
  height: 34px;
`;

const ConditionEqualOperator = styled('div')`
  color: ${p => p.theme.purple300};
`;

const Operator = styled('div')`
  color: ${p => p.theme.active};
`;

const SampleRate = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 34px;
  justify-content: center;
`;

const ConditionName = styled('div')`
  color: ${p => p.theme.gray400};
`;

const ConditionValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const ConditionSeparator = styled(ConditionValue)`
  padding-right: ${space(0.5)};
`;

const EllipisDropDownButton = styled(DropdownLink)`
  display: flex;
  align-items: center;
  transition: none;
`;
