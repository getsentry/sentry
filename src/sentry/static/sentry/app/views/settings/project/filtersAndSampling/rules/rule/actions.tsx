import React from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconDelete, IconDownload, IconEdit, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';

const deleteRuleConfirmMessage = t(
  'Are you sure you wish to delete this dynamic sampling rule?'
);

const deleteRuleMessage = t(
  'You do not have permission to delete dynamic sampling rules.'
);

const editRuleMessage = t('You do not have permission to edit dynamic sampling rules.');

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
          title={disabled ? editRuleMessage : undefined}
        />
        <Confirm
          priority="danger"
          message={deleteRuleConfirmMessage}
          onConfirm={onDeleteRule}
          disabled={disabled}
        >
          <Button
            label={t('Delete Rule')}
            size="small"
            icon={<IconDelete />}
            title={disabled ? deleteRuleMessage : undefined}
          />
        </Confirm>
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
          onClick={
            !disabled
              ? onEditRule
              : event => {
                  event?.stopPropagation();
                }
          }
          disabled={disabled}
        >
          <Tooltip
            disabled={!disabled}
            title={editRuleMessage}
            containerDisplayMode="block"
          >
            {t('Edit')}
          </Tooltip>
        </MenuItemActionLink>
        <MenuItemActionLink
          onAction={onDeleteRule}
          message={deleteRuleConfirmMessage}
          icon={<IconDownload size="xs" />}
          title={t('Delete')}
          disabled={disabled}
          priority="danger"
          shouldConfirm
        >
          <Tooltip
            disabled={!disabled}
            title={deleteRuleMessage}
            containerDisplayMode="block"
          >
            {t('Delete')}
          </Tooltip>
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
    display: grid;
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
