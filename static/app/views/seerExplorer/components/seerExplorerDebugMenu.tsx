import {IconOpen} from '@sentry/icons/open';
import {IconSliders} from '@sentry/icons/sliders';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

interface SeerExplorerDebugMenuProps {
  onOverrideBashModeToggle: () => void;
  overrideBashModeEnabled: boolean;
  conversationsUrl?: string;
}

export function SeerExplorerDebugMenu({
  overrideBashModeEnabled,
  onOverrideBashModeToggle,
  conversationsUrl,
}: SeerExplorerDebugMenuProps) {
  const isSentryEmployee = useIsSentryEmployee();

  const showDebugRegion = isSentryEmployee;
  // The agent trace is an internal view, so it shares the employee gate.
  const showLinksRegion = isSentryEmployee && !!conversationsUrl;

  if (!showDebugRegion && !showLinksRegion) {
    return null;
  }

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
