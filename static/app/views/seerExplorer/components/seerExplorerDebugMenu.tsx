import {IconBug} from '@sentry/icons/bug';
import {IconOpen} from '@sentry/icons/open';

import {
  CompactSelect,
  type SelectOption,
  type SelectSection,
} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';

type DebugOption = 'force-bash-mode' | 'agent-trace';

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

  const toggleOptions: Array<SelectOption<DebugOption>> = [
    {value: 'force-bash-mode' as const, label: t('Force bash mode on')},
  ];
  const sections: Array<SelectSection<DebugOption>> = [
    {key: 'toggles', options: toggleOptions},
    ...(conversationsUrl
      ? [
          {
            key: 'links',
            options: [
              {
                value: 'agent-trace' as const,
                label: t('Open agent trace'),
                leadingItems: <IconOpen />,
                // This is an action, not a toggle, so it never holds selection.
                hideCheck: true,
              },
            ],
          },
        ]
      : []),
  ];
  const value: DebugOption[] = overrideBashModeEnabled ? ['force-bash-mode'] : [];

  if (!isSentryEmployee) {
    return null;
  }

  return (
    <CompactSelect
      multiple
      options={sections}
      value={value}
      onChange={selectedOptions => {
        const selectedValues = new Set(selectedOptions.map(option => option.value));
        if (selectedValues.has('agent-trace')) {
          window.open(conversationsUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        if (selectedValues.has('force-bash-mode') !== overrideBashModeEnabled) {
          onOverrideBashModeToggle();
        }
      }}
      // Toggles keep the menu open; opening the trace closes it.
      closeOnSelect={selectedOptions =>
        selectedOptions.some(option => option.value === 'agent-trace')
      }
      position="bottom-end"
      preventOverflowOptions={{boundary: document.body}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          aria-label={t('Debug')}
          icon={<IconBug />}
          variant="transparent"
          size="xs"
        >
          <Container as="span" display={{zero: 'none', sm: 'inline'}}>
            {t('Debug')}
          </Container>
        </OverlayTrigger.Button>
      )}
    />
  );
}
