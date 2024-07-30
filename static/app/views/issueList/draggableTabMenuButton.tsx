import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';

interface DraggableTabMenuButtonProps {
  menuOptions: MenuItemProps[];
  hasUnsavedChanges?: boolean;
  triggerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children'>;
}

export function DraggableTabMenuButton({
  triggerProps,
  hasUnsavedChanges = false,
  menuOptions,
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
