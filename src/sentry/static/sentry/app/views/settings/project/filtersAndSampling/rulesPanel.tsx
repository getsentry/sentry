import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel, PanelFooter} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';

import Rules from './rules';

type Props = React.ComponentProps<typeof Rules> & {
  onAddRule: () => void;
  platformDocLink?: string;
};

function RulesPanel({platformDocLink, disabled, onAddRule, ...props}: Props) {
  return (
    <Panel>
      <Rules disabled={disabled} {...props} />
      <StyledPanelFooter>
        <ButtonBar gap={1}>
          {platformDocLink && (
            <Button href={platformDocLink} external>
              {t('Read the docs')}
            </Button>
          )}
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
  border: none;
`;
