import {useContext} from 'react';
import {useTheme} from '@emotion/react';

import {ExpandedContext} from 'sentry/components/sidebar/sidebarAccordion';
import useMedia from 'sentry/utils/useMedia';

type Props = {
  sidebarCollapsed: boolean;
};

function SidebarSmallScreen({sidebarCollapsed}: Props) {
  const {items, setItems} = useContext(ExpandedContext);
  const theme = useTheme();
  const horizontal = useMedia(`(max-width: ${theme.breakpoints.medium})`);

  const shouldResetExpandedId = !horizontal && !sidebarCollapsed;

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
        width: '200px',
        color: 'white',
        backgroundColor: 'white',
      }}
    >
      {items}
    </div>
  );
}

export default SidebarSmallScreen;
