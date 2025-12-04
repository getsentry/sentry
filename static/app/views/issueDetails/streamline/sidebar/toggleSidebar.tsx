import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {chonkStyled} from 'sentry/utils/theme/theme';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function ToggleSidebar({size = 'md'}: {size?: 'md' | 'sm'}) {
  const organization = useOrganization();
  const {isSidebarOpen, dispatch} = useIssueDetails();
  const direction = isSidebarOpen ? 'right' : 'left';
  const theme = useTheme();

  const props = size === 'md' ? undefined : {style: {height: '26px'}};

  return (
    <ToggleContainer sidebarOpen={isSidebarOpen ?? true}>
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
  margin-right: -${p => p.theme.space['2xl']};
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
    left: ${p => p.theme.space.xs};
    width: calc(100% - ${p => p.theme.space.xs} + 1px);
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
  left: ${p => p.theme.space.sm};
`;
