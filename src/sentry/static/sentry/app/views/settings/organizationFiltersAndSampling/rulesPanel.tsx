import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelFooter} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

import Rules from './rules';

type Props = {
  rules: Array<DynamicSamplingRule>;
  docsUrl: string;
  onAddRule: () => void;
};

function RulesPanel({rules, docsUrl, onAddRule}: Props) {
  return (
    <Panel>
      <Rules rules={rules} />
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

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)} ${space(2)};
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;
