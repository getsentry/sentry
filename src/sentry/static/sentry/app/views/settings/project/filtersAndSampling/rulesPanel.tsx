import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelFooter} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';

import Rules from './rules';
import {DYNAMIC_SAMPLING_DOC_LINK} from './utils';

type Props = React.ComponentProps<typeof Rules> & {
  onAddRule: () => void;
};

function RulesPanel({
  rules,
  onAddRule,
  onEditRule,
  onDeleteRule,
  disabled,
  onUpdateRules,
}: Props) {
  return (
    <Panel>
      <Rules
        rules={rules}
        onEditRule={onEditRule}
        onDeleteRule={onDeleteRule}
        disabled={disabled}
        onUpdateRules={onUpdateRules}
      />
      <StyledPanelFooter>
        <ButtonBar gap={1}>
          <Button href={DYNAMIC_SAMPLING_DOC_LINK} external>
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
