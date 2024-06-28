import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

const TAB_MENU_OPTIONS: MenuItemProps[] = [
  {
    key: 'save-changes',
    label: t('Save Changes'),
    priority: 'primary',
  },
  {
    key: 'discard-changes',
    label: t('Discard Changes'),
  },
  {
    key: 'rename-tab',
    label: t('Rename'),
    showDivider: true,
  },
  {
    key: 'duplicate-tab',
    label: t('Duplicate'),
  },
  {
    key: 'delete-tab',
    label: t('Delete'),
    priority: 'danger',
  },
];

interface DraggableTabMenuButtonProps {
  isChanged: boolean;
  triggerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children'>;
}

export function DraggableTabMenuButton({
  triggerProps,
  isChanged,
}: DraggableTabMenuButtonProps) {
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
        items={TAB_MENU_OPTIONS}
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
