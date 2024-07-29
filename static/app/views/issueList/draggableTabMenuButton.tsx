import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';

interface DraggableTabMenuButtonProps {
  hasUnsavedChanges?: boolean;

  /**
   * Callback function to be called when user clicks the `Delete` button (for persistent tabs)
   * Note: The `Delete` button only appears when `isTempTab=false` (persistent tabs)
   */
  onDelete?: (key: MenuItemProps['key']) => void;

  /**
   * Callback function to be called when user clicks on the `Discard Changes` button
   * Note: The `Discard Changes` button only appears for persistent tabs when `isChanged=true`
   */
  onDiscard?: (key: MenuItemProps['key']) => void;

  /**
   * Callback function to be called when user clicks the 'Duplicate' Button
   * Note: The `Duplicate` button only appears when `isTempTab=false` (persistent tabs)
   */
  onDuplicate?: (key: MenuItemProps['key']) => void;

  /**
   * Callback function to be called when user clicks the 'Rename' Button
   * Note: The `Rename` button only appears when `isTempTab=false` (persistent tabs)
   * @returns
   */
  onRename?: (key: MenuItemProps['key']) => void;
  /**
   * Callback function to be called when user clicks the 'Save' button.
   * Note: The `Save` button only appears for persistent tabs when `isChanged=true`, or when `isTempTab=true`
   */
  onSave?: (key: MenuItemProps['key']) => void;
  triggerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children'>;
}

export function DraggableTabMenuButton({
  triggerProps,
  hasUnsavedChanges = false,
  onDelete,
  onDiscard,
  onDuplicate,
  onRename,
  onSave,
}: DraggableTabMenuButtonProps) {
  const hasUnsavedChangesMenuOptions: MenuItemProps[] = [
    {
      key: 'save-changes',
      label: t('Save Changes'),
      priority: 'primary',
      onAction: onSave,
    },
    {
      key: 'discard-changes',
      label: t('Discard Changes'),
      onAction: onDiscard,
    },
  ];

  const defaultMenuOptions: MenuItemProps[] = [
    {
      key: 'rename-tab',
      label: t('Rename'),
      onAction: onRename,
    },
    {
      key: 'duplicate-tab',
      label: t('Duplicate'),
      onAction: onDuplicate,
    },
    {
      key: 'delete-tab',
      label: t('Delete'),
      priority: 'danger',
      onAction: onDelete,
    },
  ];

  const menuOptions = hasUnsavedChanges
    ? [
        {
          key: 'changed',
          children: hasUnsavedChangesMenuOptions,
        },
        {
          key: 'default',
          children: defaultMenuOptions,
        },
      ]
    : defaultMenuOptions;

  return (
    <TriggerIconWrap>
      <StyledDropdownMenu
        position="bottom-start"
        triggerProps={{
          size: 'zero',
          showChevron: false,
          borderless: true,
          icon: (
            <Fragment>
              <StyledDropdownButton
                {...triggerProps}
                aria-label="Tab Options"
                borderless
                size="zero"
                icon={<IconEllipsis compact />}
              />
              {hasUnsavedChanges && <UnsavedChangesIndicator role="presentation" />}
            </Fragment>
          ),
          style: {width: '18px', height: '16px'},
        }}
        items={menuOptions}
        offset={[-10, 5]}
      />
    </TriggerIconWrap>
  );
}

const StyledDropdownMenu = styled(DropdownMenu)`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const UnsavedChangesIndicator = styled('div')`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.theme.active};
  border: solid 1px ${p => p.theme.background};
  position: absolute;
  top: -3px;
  right: -3px;
`;

const StyledDropdownButton = styled(Button)`
  width: 18px;
  height: 16px;
  border: 1px solid ${p => p.theme.gray200};
  gap: 5px;
  border-radius: 4px;
`;
const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
