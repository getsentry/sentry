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
    <Wrapper>
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
    </Wrapper>
  );
}

export default Actions;

const Wrapper = styled('div')`
  flex: 1;
  display: flex;
  justify-content: flex-end;
`;

const StyledButtonbar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

const StyledDropdownLink = styled(DropdownLink)`
  transition: none;

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;
