import React from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import Rule from './rule';

type Props = {
  rules: Array<DynamicSamplingRule>;
  onEditRule: (rule: DynamicSamplingRule) => () => void;
  onDeleteRule: (rule: DynamicSamplingRule) => () => void;
  disabled: boolean;
};

function Rules({rules, onEditRule, onDeleteRule, disabled}: Props) {
  return (
    <StyledPanelTable
      headers={['', t('Event Type'), t('Category'), t('Sampling Rate'), '']}
      isEmpty={!rules.length}
      emptyMessage={t('There are no rules to display')}
    >
      {rules.map((rule, index) => (
        <Rule
          key={index}
          rule={rule}
          onEditRule={onEditRule(rule)}
          onDeleteRule={onDeleteRule(rule)}
          disabled={disabled}
        />
      ))}
    </StyledPanelTable>
  );
}

export default Rules;

const StyledPanelTable = styled(PanelTable)`
  overflow: visible;
  margin-bottom: 0;
  border: none;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;

  > * {
    overflow: hidden;

    :nth-child(-n + 5) {
      ${overflowEllipsis};
      :nth-child(5n - 1) {
        text-align: center;
      }
    }

    @media (max-width: ${p => p.theme.breakpoints[0]}) {
      :nth-child(5n - 4),
      :nth-child(5n - 3) {
        display: none;
      }
    }

    :nth-child(5n) {
      overflow: visible;
    }
  }

  grid-template-columns: 1.5fr 1fr max-content;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: max-content 1fr 1.5fr 1fr max-content;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: max-content 1fr 2fr 1fr max-content;
  }
`;
