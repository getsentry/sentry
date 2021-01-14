import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelFooter, PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

type Props = {
  rules: Array<DynamicSamplingRule>;
  docsUrl: string;
  onAddRule: () => void;
};

function RulesPanel({rules, docsUrl, onAddRule}: Props) {
  return (
    <Panel>
      <StyledPanelTable
        headers={[t('Type'), t('Projects'), t('Condition'), t('Sampling Rate')]}
        isEmpty={!rules.length}
      >
        {null}
      </StyledPanelTable>
      <StyledPanelFooter>
        <ButtonBar gap={1}>
          <Button href={docsUrl} external>
            {t('Read the docs')}
          </Button>
          <Button priority="primary" onClick={onAddRule}>
            {t('Add rule')}
          </Button>
        </ButtonBar>
      </StyledPanelFooter>
    </Panel>
  );
}

export default RulesPanel;

// TODO(Priscila): Add PanelTable footer prop
const StyledPanelTable = styled(PanelTable)`
  margin-bottom: 0;
  border: none;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
`;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
