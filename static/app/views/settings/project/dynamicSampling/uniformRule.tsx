import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {SamplingRule} from 'sentry/types/sampling';
import {formatPercentage} from 'sentry/utils/formatters';

import {
  ActivateTogglePlaceholder,
  ActiveColumn,
  ActiveToggle,
  Column,
  ConditionColumn,
  DragColumn,
  Operator,
  OperatorColumn,
  RateColumn,
  SampleRate,
} from './rule';

type Props = {
  loadingRecommendedSdkUpgrades: boolean;
  rule: SamplingRule;
  singleRule: boolean;
};

export function UniformRule({singleRule, rule, loadingRecommendedSdkUpgrades}: Props) {
  return (
    <Wrapper isContent data-test-id="sampling-rule">
      <DragColumn />
      <OperatorColumn>
        <Operator>{singleRule ? t('If') : t('Else')}</Operator>
      </OperatorColumn>
      <ConditionColumn>{singleRule ? t('All') : null}</ConditionColumn>
      <RateColumn>
        <SampleRate>{formatPercentage(rule.sampleRate)}</SampleRate>
      </RateColumn>
      <ActiveColumn>
        {loadingRecommendedSdkUpgrades ? (
          <ActivateTogglePlaceholder />
        ) : (
          <Tooltip title={t('Uniform rule is always active and cannot be toggled')}>
            <ActiveToggle
              inline={false}
              hideControlState
              name="uniform-rule-toggle"
              value={rule.active}
              disabled
            />
          </Tooltip>
        )}
      </ActiveColumn>
      <Column />
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
