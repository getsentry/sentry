import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelFooter} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import Rules from './rules';
import {DOC_LINK} from './utils';

type Props = {
  rules: Array<DynamicSamplingRule>;
  onEditRule: (rule: DynamicSamplingRule) => () => void;
  onDeleteRule: (rule: DynamicSamplingRule) => () => void;
  onAddRule: () => void;
  disabled: boolean;
};

function RulesPanel({rules, onAddRule, onEditRule, onDeleteRule, disabled}: Props) {
  return (
    <Panel>
      <Rules
        rules={rules}
        onEditRule={onEditRule}
        onDeleteRule={onDeleteRule}
        disabled={disabled}
      />
      <StyledPanelFooter>
        <ButtonBar gap={1}>
          <Button href={DOC_LINK} external>
            {t('Read the docs')}
          </Button>
          <Button priority="primary" onClick={onAddRule} disabled={disabled}>
            {t('Add rule')}
          </Button>
        </ButtonBar>
      </StyledPanelFooter>
    </Panel>
  );
}

export default RulesPanel;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
