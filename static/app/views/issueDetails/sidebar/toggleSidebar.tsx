import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/context';

export function ToggleSidebar({size = 'md'}: {size?: 'md' | 'sm'}) {
  const organization = useOrganization();
  const {isSidebarOpen, dispatch} = useIssueDetails();

  return (
    <Container position="relative" display={{zero: 'none', '4xl': 'block'}}>
      <ToggleButton
        expanded={isSidebarOpen}
        onClick={() => dispatch({type: 'UPDATE_SIDEBAR_STATE', isOpen: !isSidebarOpen})}
        aria-label={isSidebarOpen ? t('Close sidebar') : t('Open sidebar')}
        style={size === 'md' ? undefined : {height: '26px'}}
        analyticsEventKey="issue_details.sidebar_toggle"
        analyticsEventName="Issue Details: Sidebar Toggle"
        analyticsParams={{
          sidebar_open: !isSidebarOpen,
          org_streamline_only: organization.streamlineOnly ?? undefined,
        }}
        icon={
          <IconChevron direction={isSidebarOpen ? 'right' : 'left'} isDouble size="xs" />
        }
      />
    </Container>
  );
}

// The extra 1px on width is to display above the sidebar border
const ToggleButton = styled(Button)<{expanded: boolean}>`
  ${p =>
    p.expanded &&
    css`
      margin-right: calc(-${p.theme.space.xl} - 1px);
      /* Square the right corners on both layers so the shadow (::before) reaches the edge like the surface (::after) */
      &::before,
      &::after {
        border-top-right-radius: 0px;
        border-bottom-right-radius: 0px;
      }
      &::after {
        border-right-color: transparent;
      }
    `}
`;
