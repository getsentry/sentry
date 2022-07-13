import {Fragment} from 'react';
import {DraggableSyntheticListeners, UseDraggableArguments} from '@dnd-kit/core';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import DropdownLink from 'sentry/components/dropdownLink';
import NewBooleanField from 'sentry/components/forms/booleanField';
import Tooltip from 'sentry/components/tooltip';
import {IconDownload, IconEllipsis} from 'sentry/icons';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {SamplingRule, SamplingRuleOperator} from 'sentry/types/sampling';

import {getInnerNameLabel, isUniformRule} from './utils';

type Props = {
  dragging: boolean;
  /**
   * Hide the grab button if true.
   * This is used when the list has a single item, making sorting not possible.
   */
  hideGrabButton: boolean;
  listeners: DraggableSyntheticListeners;
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
}: Props) {
  const isUniform = isUniformRule(rule);
  const canDelete = !noPermission && !isUniform;
  const canActivate = true; // TODO(sampling): Enabling this for demo purposes, change this back to `!upgradeSdkForProjects.length;` for LA
  const canDrag = !isUniform && !noPermission;

  return (
    <Fragment>
      <GrabColumn disabled={!canDrag}>
        {hideGrabButton ? null : (
          <Tooltip
            title={
              noPermission
                ? t('You do not have permission to reorder rules')
                : isUniform
                ? t('Uniform rules cannot be reordered')
                : undefined
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
        <SampleRate>{`${rule.sampleRate * 100}\u0025`}</SampleRate>
      </RateColumn>
      <ActiveColumn>
        <GuideAnchor
          target="sampling_rule_toggle"
          onFinish={onActivate}
          disabled={!canActivate || !isUniform}
        >
          <Tooltip
            disabled={canActivate}
            title={
              !canActivate
                ? tn(
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
        </GuideAnchor>
      </ActiveColumn>
      <Column>
        <EllipisDropDownButton
          caret={false}
          customTitle={
            <Button aria-label={t('Actions')} icon={<IconEllipsis />} size="sm" />
          }
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
              title={t('You do not have permission to edit sampling rules')}
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
            disabled={!canDelete}
            priority="danger"
            shouldConfirm
          >
            <Tooltip
              disabled={canDelete}
              title={
                isUniform
                  ? t("You can't delete the uniform rule")
                  : t('You do not have permission to delete sampling rules')
              }
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
