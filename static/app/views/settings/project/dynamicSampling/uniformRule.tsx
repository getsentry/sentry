import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {SamplingRule} from 'sentry/types/sampling';
import {formatPercentage} from 'sentry/utils/formatters';

import {
  ActiveColumn,
  Column,
  ConditionColumn,
  DragColumn,
  Operator,
  OperatorColumn,
  RateColumn,
  SampleRate,
} from './rule';

type Props = {
  rule: SamplingRule;
  singleRule: boolean;
};

export function UniformRule({singleRule, rule}: Props) {
  return (
    <RulesPanelLayout isContent data-test-id="sampling-rule">
      <DragColumn />
      <OperatorColumn>
        <Operator>{singleRule ? t('If') : t('Else')}</Operator>
      </OperatorColumn>
      <ConditionColumn>{singleRule ? t('All') : null}</ConditionColumn>
      <RateColumn>
        <SampleRate>{formatPercentage(rule.sampleRate)}</SampleRate>
      </RateColumn>
      <ActiveColumn />
      <Column />
    </RulesPanelLayout>
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
