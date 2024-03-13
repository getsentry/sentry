import {useContext, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ExpandedContext} from 'sentry/components/sidebar/sidebarAccordion';
import {space} from 'sentry/styles/space';
import useMedia from 'sentry/utils/useMedia';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

type Props = {
  sidebarCollapsed: boolean;
};

function SidebarSmallScreen({sidebarCollapsed}: Props) {
  const {items, setItems, title} = useContext(ExpandedContext);
  const theme = useTheme();
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const panelRef = useRef<HTMLDivElement>(null);
  const shouldResetExpandedId = !horizontal && !sidebarCollapsed;

  useOnClickOutside(panelRef, () => {
    setItems(null);
  });

  if (shouldResetExpandedId) {
    setItems(null);
    return null;
  }

  if (!items) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        padding: space(2),
        top: theme.sidebar.mobileHeight,
        left: 0,
        backgroundColor: 'white',
      }}
      ref={panelRef}
    >
      <SidebarItemLabel>{title}</SidebarItemLabel>
      {items}
    </div>
  );
}

const SidebarItemLabel = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
`;

export default SidebarSmallScreen;
