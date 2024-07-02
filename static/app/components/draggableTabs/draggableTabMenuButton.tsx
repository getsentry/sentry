import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

interface DraggableTabMenuButtonProps {
  isChanged?: boolean;
  isTempTab?: boolean;

  /**
   * Callback function to be called when user clicks the `Delete` button (for persistent tabs)
   * Note: The `Delete` button only appears when `isTempTab=false` (persistent tabs)
   */
  onDelete?: () => void;

  /**
   * Callback function to be called when user clicks on the `Discard Changes` button
   * Note: The `Discard Changes` button only appears for persistent tabs when `isChanged=true`
   */
  onDiscardChanges?: () => void;

  /**
   * Callback function to be called when use clicks on the `Discard View` button
   * Note: The `Discard View` button only appears when `isTempTab=true` (temporary tabs)
   */
  onDiscardTempView?: () => void;

  /**
   * Callback function to be called when user clicks the 'Duplicate' Button
   * Note: The `Duplicate` button only appears when `isTempTab=false` (persistent tabs)
   */
  onDuplicate?: () => void;

  /**
   * Callback function to be called when user clicks the 'Rename' Button
   * Note: The `Rename` button only appears when `isTempTab=false` (persistent tabs)
   * @returns
   */
  onRename?: () => void;

  /**
   * Callback function to be called when user clicks the 'Save' button.
   * Note: The `Save` button only appears for persistent tabs when `isChanged=true`, or when `isTempTab=true`
   */
  onSave?: () => void;
  triggerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children'>;
}

export function DraggableTabMenuButton({
  isTempTab,
  triggerProps,
  isChanged = false,
  onDelete,
  onDiscardChanges,
  onDiscardTempView,
  onDuplicate,
  onRename,
  onSave,
}: DraggableTabMenuButtonProps) {
  const changedMenuOptions: MenuItemProps[] = [
    {
      key: 'save-changes',
      label: t('Save Changes'),
      priority: 'primary',
      onAction: onSave,
    },
    {
      key: 'discard-changes',
      label: t('Discard Changes'),
      onAction: onDiscardChanges,
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

  const tempTabMenuOptions: MenuItemProps[] = [
    {
      key: 'save-changes',
      label: t('Save View'),
      priority: 'primary',
      onAction: onSave,
    },
    {
      key: 'discard-temp-view',
      label: t('Discard'),
      priority: 'danger',
      onAction: onDiscardTempView,
    },
  ];
  let menuOptions: MenuItemProps[] = [];
  if (isTempTab) {
    menuOptions = tempTabMenuOptions;
  } else if (isChanged) {
    menuOptions = [
      {
        key: 'changed',
        children: changedMenuOptions,
      },
      {
        key: 'default',
        children: defaultMenuOptions,
      },
    ];
  } else {
    menuOptions = defaultMenuOptions;
  }

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
                icon={<IconCompactEllipsis />}
              />
              {isChanged && <ChangedAndUnsavedIndicator role="presentation" />}
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

function IconCompactEllipsis() {
  return (
    <SvgIcon>
      <circle cx="8" cy="8" r="1.11" />
      <circle cx="2.5" cy="8" r="1.11" />
      <circle cx="13.5" cy="8" r="1.11" />
    </SvgIcon>
  );
}

const StyledDropdownMenu = styled(DropdownMenu)`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

export const ChangedAndUnsavedIndicator = styled('div')`
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
