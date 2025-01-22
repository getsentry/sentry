import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function ToggleSidebar({size = 'lg'}: {size?: 'lg' | 'sm'}) {
  const organization = useOrganization();
  const {isSidebarOpen, dispatch} = useIssueDetails();
  const direction = isSidebarOpen ? 'right' : 'left';
  return (
    <ToggleContainer
      sidebarOpen={isSidebarOpen ?? true}
      style={{paddingTop: size === 'lg' ? '4px' : '0px'}}
    >
      <ToggleButton
        onClick={() => dispatch({type: 'UPDATE_SIDEBAR_STATE', isOpen: !isSidebarOpen})}
        aria-label={isSidebarOpen ? t('Close sidebar') : t('Open sidebar')}
        style={{height: size === 'lg' ? '30px' : '26px'}}
        analyticsEventKey="issue_details.sidebar_toggle"
        analyticsEventName="Issue Details: Sidebar Toggle"
        analyticsParams={{
          sidebar_open: !isSidebarOpen,
          org_streamline_only: organization.streamlineOnly ?? undefined,
        }}
      >
        <LeftChevron direction={direction} />
        <RightChevron direction={direction} />
      </ToggleButton>
    </ToggleContainer>
  );
}

const ToggleContainer = styled('div')<{sidebarOpen: boolean}>`
  width: ${p => (p.sidebarOpen ? '30px' : '50px')};
  position: relative;
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;

// The extra 1px on width is to display above the sidebar border
const ToggleButton = styled(Button)`
  border-radius: ${p => p.theme.borderRadiusLeft};
  border-right-color: ${p => p.theme.background} !important;
  box-shadow: none;
  position: absolute;
  padding: 0;
  left: ${space(0.5)};
  width: calc(100% - ${space(0.5)} + 1px);
  outline: 0;
  min-height: unset;
`;

const LeftChevron = styled(IconChevron)`
  position: absolute;
  color: ${p => p.theme.subText};
  height: 10px;
  width: 10px;
  left: ${space(0.75)};
`;

const RightChevron = styled(LeftChevron)`
  left: ${space(1.5)};
`;
