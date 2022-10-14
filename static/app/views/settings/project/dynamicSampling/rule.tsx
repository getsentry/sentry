import {Fragment} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import NewBooleanField from 'sentry/components/forms/fields/booleanField';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {IconEllipsis, IconWarning} from 'sentry/icons';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {SamplingRule, SamplingRuleOperator} from 'sentry/types/sampling';
import {formatPercentage} from 'sentry/utils/formatters';

import {getInnerNameLabel} from './utils';

type Props = {
  dragging: boolean;
  /**
   * Hide the grab button if true.
   * This is used when the list has a single item, making sorting not possible.
   */
  hideGrabButton: boolean;
  listeners: DraggableSyntheticListeners;
  /**
   * While loading we show a placeholder in place of the "Active" toggle
   * Without this we can't know if they are able to activate the rule or not
   */
  loadingRecommendedSdkUpgrades: boolean;
  noPermission: boolean;
  onActivate: () => void;
  onDeleteRule: () => void;
  onEditRule: () => void;
  operator: SamplingRuleOperator;
  rule: SamplingRule;
  sorting: boolean;
  /**
   * If not empty, the activate rule toggle will be disabled.
   */
  upgradeSdkForProjects: Project['slug'][];
  valid: boolean;
  grabAttributes?: UseDraggableArguments['attributes'];
};

export function Rule({
  dragging,
  rule,
  noPermission,
  onEditRule,
  onDeleteRule,
  onActivate,
  listeners,
  operator,
  grabAttributes,
  hideGrabButton,
  upgradeSdkForProjects,
  loadingRecommendedSdkUpgrades,
  valid,
}: Props) {
  const canDelete = !noPermission;
  const canDrag = !noPermission;
  const canActivate =
    !noPermission && valid && (!upgradeSdkForProjects.length || !!rule.active);

  return (
    <Fragment>
      <DragColumn disabled={!canDrag}>
        {!hideGrabButton && (
          <Tooltip
            title={
              noPermission ? t('You do not have permission to reorder rules') : undefined
            }
            containerDisplayMode="flex"
          >
            <IconGrabbableWrapper
              {...listeners}
              {...grabAttributes}
              aria-label={dragging ? t('Drop Rule') : t('Drag Rule')}
              aria-disabled={!canDrag}
            >
              <IconGrabbable />
            </IconGrabbableWrapper>
          </Tooltip>
        )}
      </DragColumn>
      <OperatorColumn>
        <Operator>
          {operator === SamplingRuleOperator.IF
            ? t('If')
            : operator === SamplingRuleOperator.ELSE_IF
            ? t('Else if')
            : t('Else ')}
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
                    {[...condition.value].map((conditionValue, conditionValueIndex) => (
                      <Fragment key={conditionValue}>
                        <ConditionValue>{conditionValue}</ConditionValue>
                        {conditionValueIndex !==
                          (condition.value as string[]).length - 1 && (
                          <ConditionSeparator>{'\u002C'}</ConditionSeparator>
                        )}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <ConditionValue>{String(condition.value)}</ConditionValue>
                )}
              </Fragment>
            ))}
      </ConditionColumn>
      <RateColumn>
        <SampleRate>
          {!valid && (
            <Tooltip
              title={t(
                "It looks like the uniform rule's sample rate has been updated and is now higher than this rule's sample rate, so this rule is no longer valid."
              )}
            >
              <StyledIconWarning data-test-id="icon-warning" />
            </Tooltip>
          )}
          {formatPercentage(rule.sampleRate)}
        </SampleRate>
      </RateColumn>
      <ActiveColumn>
        {!hideGrabButton &&
          (loadingRecommendedSdkUpgrades ? (
            <ActivateTogglePlaceholder />
          ) : (
            <Tooltip
              disabled={canActivate}
              title={
                !canActivate
                  ? !valid
                    ? t(
                        'To enable this rule, its sample rate must be updated with a value greater than the uniform rule (Else) sample rate.'
                      )
                    : tn(
                        'To enable the rule, the recommended sdk version have to be updated',
                        'To enable the rule, the recommended sdk versions have to be updated',
                        upgradeSdkForProjects.length
                      )
                  : undefined
              }
            >
              <ActiveToggle
                inline={false}
                hideControlState
                aria-label={rule.active ? t('Deactivate Rule') : t('Activate Rule')}
                onClick={onActivate}
                name="active"
                disabled={!canActivate}
                value={rule.active}
              />
            </Tooltip>
          ))}
      </ActiveColumn>
      <Column>
        {!hideGrabButton && (
          <DropdownMenuControl
            position="bottom-end"
            triggerProps={{
              size: 'xs',
              icon: <IconEllipsis size="xs" />,
              showChevron: false,
              'aria-label': t('Actions'),
            }}
            items={[
              {
                key: 'edit',
                label: t('Edit'),
                details: noPermission
                  ? t("You don't have permission to edit rules")
                  : undefined,
                onAction: onEditRule,
                disabled: noPermission,
              },
              {
                key: 'delete',
                label: t('Delete'),
                details: canDelete
                  ? undefined
                  : t("You don't have permission to delete rules"),
                onAction: () =>
                  openConfirmModal({
                    onConfirm: onDeleteRule,
                    message: t('Are you sure you wish to delete this rule?'),
                  }),
                disabled: !canDelete,
                priority: 'danger',
              },
            ]}
          />
        )}
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

export const DragColumn = styled(Column)<{disabled?: boolean}>`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
  }

  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.disabled};
      > * {
        [role='button'] {
          cursor: not-allowed;
        }
      }
    `}
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
  button {
    cursor: grab;
  }
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
  display: grid;
  grid-template-columns: max-content max-content;
  height: 34px;
  line-height: 34px;
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

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.alert.warning.iconColor};
  :hover {
    color: ${p => p.theme.alert.warning.iconHoverColor};
  }
  vertical-align: middle;
  margin-right: ${space(1)};
`;

const ActivateTogglePlaceholder = styled(Placeholder)`
  height: 24px;
  margin-top: ${space(0.5)};
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 34px;
  justify-content: center;
`;
