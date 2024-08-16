import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';

interface DraggableTabMenuButtonProps {
  menuOptions: MenuItemProps[];
  'aria-label'?: string;
  hasUnsavedChanges?: boolean;
}

export function DraggableTabMenuButton({
  hasUnsavedChanges = false,
  menuOptions,
  ...props
}: DraggableTabMenuButtonProps) {
  return (
    <TriggerIconWrap>
      <StyledDropdownMenu
        position="bottom-start"
        triggerProps={{
          'aria-label': props['aria-label'] ?? 'Tab Options',
          size: 'zero',
          showChevron: false,
          borderless: true,
          icon: (
            <ButtonWrapper>
              <IconEllipsis compact />
              {hasUnsavedChanges && <UnsavedChangesIndicator role="presentation" />}
            </ButtonWrapper>
          ),
          style: {width: '18px', height: '16px', borderRadius: '4px'},
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
const ButtonWrapper = styled('div')`
  width: 18px;
  height: 16px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: 4px;
`;

const TriggerIconWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;
