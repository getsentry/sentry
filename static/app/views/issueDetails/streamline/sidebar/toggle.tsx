import styled from '@emotion/styled';
import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

export function SidebarToggle() {
  const [sidebarOpen, setSidebarOpen] = useSyncedLocalStorageState(
    'issue-details-sidebar-open',
    true
  );
  const direction = sidebarOpen ? 'right' : 'left';
  return (
    <ToggleButton onClick={() => setSidebarOpen(!sidebarOpen)}>
      <LeftChevron direction={direction} size="xs" />
      <RightChevron direction={direction} size="xs" />
    </ToggleButton>
  );
}

const ToggleButton = styled(Button)`
  border-radius: ${p => p.theme.borderRadiusLeft};
  border-right-color: ${p => p.theme.background} !important;
  box-shadow: none;
  position: absolute;
  padding: 0;
  top: ${space(0.5)};
  right: 100%;
  outline: 0;
  height: 30px;
  width: 21px;
  min-height: unset;
`;

const RightChevron = styled(IconChevron)`
  position: absolute;
  top: calc(50%-12px);
  color: ${p => p.theme.subText};
  height: 12px;
  width: 12px;
  left: 8px;
`;

const LeftChevron = styled(RightChevron)`
  left: 2px;
`;
