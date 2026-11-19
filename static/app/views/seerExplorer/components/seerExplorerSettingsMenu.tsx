import {IconOpen} from '@sentry/icons/open';
import {IconPanel} from '@sentry/icons/panel';
import {IconSliders} from '@sentry/icons/sliders';
import {IconWindow} from '@sentry/icons/window';

import {CompositeSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import type {SeerExplorerSidebarPosition} from 'sentry/views/seerExplorer/types';

type DockOption = SeerExplorerSidebarPosition | 'windowed';

interface SeerExplorerSettingsMenuProps {
  isPipSupported: boolean;
  isPoppedOut: boolean;
  onOverrideBashModeToggle: () => void;
  onTogglePictureInPicture: () => void;
  overrideBashModeEnabled: boolean;
  conversationsUrl?: string;
  onSidebarPositionChange?: (position: SeerExplorerSidebarPosition) => void;
  sidebarPosition?: SeerExplorerSidebarPosition;
}

export function SeerExplorerSettingsMenu({
  isPipSupported,
  isPoppedOut,
  onTogglePictureInPicture,
  sidebarPosition = 'auto',
  onSidebarPositionChange,
  overrideBashModeEnabled,
  onOverrideBashModeToggle,
  conversationsUrl,
}: SeerExplorerSettingsMenuProps) {
  const isSentryEmployee = useIsSentryEmployee();

  const showDockRegion = !isPoppedOut && !!onSidebarPositionChange;
  const showDebugRegion = isSentryEmployee;
  // The agent trace is an internal view, so it shares the employee gate.
  const showLinksRegion = isSentryEmployee && !!conversationsUrl;

  if (!showDockRegion && !showDebugRegion && !showLinksRegion) {
    return null;
  }

  const dockOptions: Array<SelectOption<DockOption>> = [
    {value: 'auto', label: t('Auto'), leadingItems: <IconPanel />},
    {value: 'right', label: t('Right'), leadingItems: <IconPanel direction="right" />},
    {value: 'bottom', label: t('Bottom'), leadingItems: <IconPanel direction="down" />},
    ...(isPipSupported
      ? [{value: 'windowed' as const, label: t('Windowed'), leadingItems: <IconWindow />}]
      : []),
  ];

  return (
    <CompositeSelect
      position="top-start"
      preventOverflowOptions={{boundary: document.body}}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          aria-label={t('Seer settings')}
          tooltipProps={{title: t('Seer settings')}}
          icon={<IconSliders />}
          variant="transparent"
          size="zero"
        />
      )}
    >
      {showDockRegion && (
        <CompositeSelect.Region
          label={t('Dock position')}
          value={sidebarPosition}
          onChange={option => {
            if (option.value === 'windowed') {
              onTogglePictureInPicture();
            } else {
              onSidebarPositionChange?.(option.value);
            }
          }}
          options={dockOptions}
        />
      )}
      {showDebugRegion && (
        <CompositeSelect.Region
          label={t('Debug')}
          multiple
          closeOnSelect={false}
          value={overrideBashModeEnabled ? ['force-bash-mode'] : []}
          onChange={selectedOptions => {
            const isEnabled = selectedOptions.some(
              option => option.value === 'force-bash-mode'
            );
            if (isEnabled !== overrideBashModeEnabled) {
              onOverrideBashModeToggle();
            }
          }}
          options={[{value: 'force-bash-mode', label: t('Force bash mode on')}]}
        />
      )}
      {showLinksRegion && (
        <CompositeSelect.Region
          aria-label={t('Agent trace')}
          value={undefined}
          onChange={() => {
            window.open(conversationsUrl, '_blank', 'noopener,noreferrer');
          }}
          options={[
            {
              value: 'agent-trace',
              label: t('Open agent trace'),
              leadingItems: <IconOpen />,
              // This is an action, not a toggle, so it never holds selection.
              hideCheck: true,
            },
          ]}
        />
      )}
    </CompositeSelect>
  );
}
