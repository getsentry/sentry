import {Fragment} from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import DropdownLink from 'sentry/components/dropdownLink';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete, IconDownload, IconEdit, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';

const deleteRuleConfirmMessage = t('Are you sure you wish to delete this sampling rule?');

const deleteRuleMessage = t('You do not have permission to delete sampling rules.');

const editRuleMessage = t('You do not have permission to edit sampling rules.');

type Props = {
  disabled: boolean;
  isMenuActionsOpen: boolean;
  onDeleteRule: () => void;
  onEditRule: () => void;
  onOpenMenuActions: () => void;
};

export function Actions({
  disabled,
  onEditRule,
  onDeleteRule,
  onOpenMenuActions,
  isMenuActionsOpen,
}: Props) {
  return (
    <Fragment>
      <StyledButtonbar gap={1}>
        <Button
          aria-label={t('Edit Rule')}
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
            aria-label={t('Delete Rule')}
            size="small"
            icon={<IconDelete />}
            title={disabled ? deleteRuleMessage : undefined}
          />
        </Confirm>
      </StyledButtonbar>
      <StyledDropdownLink
        caret={false}
        customTitle={
          <Button
            aria-label={t('Actions')}
            icon={<IconEllipsis size="sm" />}
            size="xsmall"
            onClick={onOpenMenuActions}
          />
        }
        isOpen={isMenuActionsOpen}
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
    </Fragment>
  );
}

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
