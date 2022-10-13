import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SamplingRule} from 'sentry/types/sampling';
import {formatPercentage} from 'sentry/utils/formatters';

import {
  ActiveColumn,
  Column,
  ConditionColumn,
  ConditionEqualOperator,
  ConditionName,
  ConditionSeparator,
  ConditionValue,
  DragColumn,
  OperatorColumn,
  RateColumn,
  SampleRate,
} from './rule';
import {RuleActions} from './ruleActions';
import {RuleToggle} from './ruleToggle';
import {getInnerNameLabel} from './utils';

type Props = {
  /**
   * While loading we show a placeholder in place of the "Active" toggle
   * Without this we can't know if they are able to activate the rule or not
   */
  loadingRecommendedSdkUpgrades: boolean;
  noPermission: boolean;
  onDeleteRule: () => void;
  onEditRule: () => void;
  rule: SamplingRule;
};

export function InvalidRule({
  loadingRecommendedSdkUpgrades,
  rule,
  onDeleteRule,
  onEditRule,
  noPermission,
}: Props) {
  const canDelete = !noPermission;

  return (
    <Wrapper isContent data-test-id="sampling-rule">
      <DragColumn />
      <WarningColumn>
        <Tooltip
          containerDisplayMode="inline-flex"
          title={t(
            "It looks like the uniform rule's sample rate has been updated and is now higher than this rule's sample rate, so this rule is no longer valid."
          )}
        >
          <StyledIconWarning />
        </Tooltip>
      </WarningColumn>
      <ConditionColumn>
        {rule.condition.inner.map((condition, index) => (
          <Fragment key={index}>
            <ConditionName>{getInnerNameLabel(condition.name)}</ConditionName>
            <ConditionEqualOperator>{'='}</ConditionEqualOperator>
            {Array.isArray(condition.value) ? (
              <div>
                {[...condition.value].map((conditionValue, conditionValueIndex) => (
                  <Fragment key={conditionValue}>
                    <ConditionValue>{conditionValue}</ConditionValue>
                    {conditionValueIndex !== (condition.value as string[]).length - 1 && (
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
        <SampleRate>{formatPercentage(rule.sampleRate)}</SampleRate>
      </RateColumn>
      <ActiveColumn>
        <RuleToggle
          loadingRecommendedSdkUpgrades={loadingRecommendedSdkUpgrades}
          value={false}
          disabled
          disabledReason={t(
            'To enable this rule, its sample rate must be updated with a value greater than the uniform rule (Else) sample rate.'
          )}
        />
      </ActiveColumn>
      <Column>
        <RuleActions
          onDelete={onDeleteRule}
          canDelete={canDelete}
          noPermission={noPermission}
          onEditRule={onEditRule}
        />
      </Column>
    </Wrapper>
  );
}

export const RulesPanelLayout = styled('div')<{isContent?: boolean}>`
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 0.5fr 74px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 48px 97px 1fr 0.5fr 77px 74px;
  }

  ${p =>
    p.isContent &&
    css`
      > * {
        /* match the height of the ellipsis button */
        line-height: 34px;
        border-bottom: 1px solid ${p.theme.border};
      }
    `}
`;

const Wrapper = styled(RulesPanelLayout)`
  color: ${p => p.theme.disabled};
  background: ${p => p.theme.backgroundSecondary};
`;

const WarningColumn = styled(OperatorColumn)`
  align-items: center;
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.alert.warning.iconColor};
  :hover {
    color: ${p => p.theme.alert.warning.iconHoverColor};
  }
`;
