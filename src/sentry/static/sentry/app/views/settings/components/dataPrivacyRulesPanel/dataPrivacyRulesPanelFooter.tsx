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
  disableSaveButton?: boolean;
};

const DataPrivacyRulesPanelFooter = ({
  disabled,
  onAddRule,
  onCancel,
  onSave,
  hideButtonBar,
  disableSaveButton,
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
      <Actions>
        <ButtonBar gap={1.5}>
          <Button size="small" onClick={onCancel} disabled={disabled}>
            {t('Cancel')}
          </Button>
          <Button
            size="small"
            priority="primary"
            onClick={onSave}
            disabled={disabled || disableSaveButton}
          >
            {t('Save Rules')}
          </Button>
        </ButtonBar>
        <Info>{t('* The new rules will only apply to upcoming events')}</Info>
      </Actions>
    )}
  </PanelAction>
);

export default DataPrivacyRulesPanelFooter;

const PanelAction = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  display: grid;
  grid-template-columns: auto 1fr;
  grid-row-gap: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    align-items: center;
    grid-row-gap: 0;
  }
`;

const StyledLink = styled(Button)`
  color: ${p => p.theme.blue};
  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.blueDark};
  }
`;

const Actions = styled('div')`
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  flex-direction: column;
  grid-column-start: 1;
  grid-column-end: -1;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    align-items: flex-end;
    grid-column-start: auto;
    grid-column-end: auto;
  }
`;

const Info = styled('div')`
  margin-top: ${space(1)};
`;
