import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import ButtonBar from 'app/components/buttonBar';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  onAddRule: () => void;
  onSave: () => void;
  onCancel: () => void;
  hideButtonBar: boolean;
  disabled?: boolean;
};

const DataPrivacyRulesPanelFooter = ({
  disabled,
  onAddRule,
  onCancel,
  onSave,
  hideButtonBar,
}: Props) => (
  <PanelAction>
    <StyledLink
      disabled={disabled}
      icon={<IconAdd circle />}
      onClick={onAddRule}
      size="zero"
      borderless
    >
      {t('Add Rule')}
    </StyledLink>
    {!hideButtonBar && (
      <StyledButtonBar gap={1.5}>
        <Button size="small" onClick={onCancel} disabled={disabled}>
          {t('Cancel')}
        </Button>
        <Button size="small" priority="primary" onClick={onSave} disabled={disabled}>
          {t('Save Rules')}
        </Button>
      </StyledButtonBar>
    )}
  </PanelAction>
);

export default DataPrivacyRulesPanelFooter;

const PanelAction = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-end;
`;

const StyledLink = styled(Button)`
  color: ${p => p.theme.blue};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.blueDark};
  }
`;
