import React from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownLink from 'app/components/dropdownLink';
import {IconDelete, IconDownload, IconEdit, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';

type Props = {
  disabled: boolean;
  onEditRule: () => void;
  onDeleteRule: () => void;
};

function Actions({disabled, onEditRule, onDeleteRule}: Props) {
  return (
    <React.Fragment>
      <StyledButtonbar gap={1}>
        <Button
          label={t('Edit Rule')}
          size="small"
          onClick={onEditRule}
          icon={<IconEdit />}
          disabled={disabled}
        />
        <Button
          label={t('Delete Rule')}
          size="small"
          onClick={onDeleteRule}
          icon={<IconDelete />}
          disabled={disabled}
        />
      </StyledButtonbar>
      <StyledDropdownLink
        caret={false}
        customTitle={
          <Button label={t('Actions')} icon={<IconEllipsis size="sm" />} size="xsmall" />
        }
        anchorRight
      >
        <MenuItemActionLink
          shouldConfirm={false}
          icon={<IconDownload size="xs" />}
          title={t('Edit')}
        >
          {t('Edit')}
        </MenuItemActionLink>
        <MenuItemActionLink
          shouldConfirm={false}
          icon={<IconDownload size="xs" />}
          title={t('Delete')}
        >
          {t('Delete')}
        </MenuItemActionLink>
      </StyledDropdownLink>
    </React.Fragment>
  );
}

export default Actions;

const StyledButtonbar = styled(ButtonBar)`
  justify-content: flex-end;
  flex: 1;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    display: flex;
  }
`;

const StyledDropdownLink = styled(DropdownLink)`
  display: flex;
  align-items: center;
  transition: none;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;
