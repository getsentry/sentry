import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function ToggleSidebar({size = 'md'}: {size?: 'md' | 'sm'}) {
  const organization = useOrganization();
  const {isSidebarOpen, dispatch} = useIssueDetails();

  return (
    <ToggleContainer>
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
    </ToggleContainer>
  );
}

const ToggleContainer = styled('div')`
  position: relative;
  margin-right: -${p => p.theme.space['2xl']};
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;

// The extra 1px on width is to display above the sidebar border
const ToggleButton = styled(Button)<{expanded: boolean}>`
  ${p =>
    p.expanded &&
    css`
      margin-right: -1px;
      &::after {
        border-right-color: transparent;
        border-top-right-radius: 0px;
        border-bottom-right-radius: 0px;
      }
    `}
`;
