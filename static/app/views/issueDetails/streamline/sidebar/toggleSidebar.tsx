import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function ToggleSidebar({size = 'lg'}: {size?: 'lg' | 'sm'}) {
  const organization = useOrganization();
  const {isSidebarOpen, dispatch} = useIssueDetails();
  const direction = isSidebarOpen ? 'right' : 'left';
  const theme = useTheme();

  const props = theme.isChonk
    ? ({size: 'xs'} as const)
    : ({style: {height: size === 'lg' ? '30px' : '26px'}} as const);

  return (
    <ToggleContainer
      sidebarOpen={isSidebarOpen ?? true}
      style={{paddingTop: size === 'lg' ? '4px' : '0px'}}
    >
      <ToggleButton
        expanded={isSidebarOpen}
        onClick={() => dispatch({type: 'UPDATE_SIDEBAR_STATE', isOpen: !isSidebarOpen})}
        aria-label={isSidebarOpen ? t('Close sidebar') : t('Open sidebar')}
        {...props}
        analyticsEventKey="issue_details.sidebar_toggle"
        analyticsEventName="Issue Details: Sidebar Toggle"
        analyticsParams={{
          sidebar_open: !isSidebarOpen,
          org_streamline_only: organization.streamlineOnly ?? undefined,
        }}
        icon={
          theme.isChonk ? (
            <IconChevron direction={direction} isDouble size="xs" />
          ) : (
            <StyledIconChevron direction={direction} isDouble size="xs" />
          )
        }
      />
    </ToggleContainer>
  );
}

const ToggleContainer = styled('div')<{sidebarOpen: boolean}>`
  width: ${p => (p.theme.isChonk ? undefined : p.sidebarOpen ? '30px' : '50px')};
  position: relative;
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;

// The extra 1px on width is to display above the sidebar border
const ToggleButton = withChonk(
  styled(Button)<{expanded: boolean}>`
    border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
    border-right-color: ${p => p.theme.background} !important;
    box-shadow: none;
    position: absolute;
    padding: 0;
    left: ${space(0.5)};
    width: calc(100% - ${space(0.5)} + 1px);
    outline: 0;
    min-height: unset;
    color: ${p => p.theme.subText};
  `,
  chonkStyled(Button)<{expanded: boolean}>`
  ${p =>
    p.expanded &&
    `
    margin-right: -1px;
    &::after {
      border-right-color: ${p.theme.background};
      border-top-right-radius: 0px;
      border-bottom-right-radius: 0px;
    }
    `}
`
);

const StyledIconChevron = styled(IconChevron)`
  position: absolute;
  left: ${space(0.75)};
`;
