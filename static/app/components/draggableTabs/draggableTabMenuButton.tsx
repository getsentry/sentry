import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {space} from 'sentry/styles/space';

interface DraggableTabMenuButtonProps {
  triggerProps?: Omit<React.HTMLAttributes<HTMLElement>, 'children'>;
}

export function DraggableTabMenuButton({triggerProps}: DraggableTabMenuButtonProps) {
  return (
    <TriggerIconWrap>
      <StyledDropdownButton
        {...triggerProps}
        aria-label="Tab Options"
        borderless
        size="zero"
        icon={<IconCompactEllipsis />}
      />
      <ChangedAndUnsavedIndicator role="presentation" />
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

export const ChangedAndUnsavedIndicator = styled('div')`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.theme.active};
  border: solid 1px ${p => p.theme.background};
  position: absolute;
  top: -${space(0.25)};
  right: -${space(0.25)};
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
