import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconBug} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

type DebugOption = 'context-engine' | 'force-bash-mode' | 'show-thinking';

interface SeerExplorerDebugMenuProps {
  onOverrideBashModeToggle: () => void;
  onOverrideCtxEngEnableToggle: () => void;
  onShowThinkingToggle: () => void;
  overrideBashModeEnabled: boolean;
  overrideCtxEngEnable: boolean;
  showThinking: boolean;
}

/**
 * Consolidated "Debug" select holding the feature-flagged developer toggles
 * (Context Engine override, Force bash mode, Show thinking). The flag checks
 * live here so the parent doesn't thread them through — if no flags are enabled
 * the whole menu renders nothing. The toggle state stays lifted (it's consumed
 * elsewhere), so we only receive the current values and their toggle handlers.
 */
export function SeerExplorerDebugMenu({
  overrideCtxEngEnable,
  onOverrideCtxEngEnableToggle,
  overrideBashModeEnabled,
  onOverrideBashModeToggle,
  showThinking,
  onShowThinkingToggle,
}: SeerExplorerDebugMenuProps) {
  const organization = useOrganization({allowNull: true});
  const showContextEngineToggle = !!organization?.features.includes(
    'seer-explorer-context-engine-fe-override-ui-flag'
  );
  // Code mode always shows thinking with no opt-out, so keep the toggle off the
  // menu whenever that flag is on. The dedicated thinking-blocks flag still owns
  // the manual toggle for non-code-mode orgs.
  const showThinkingToggle =
    !!organization?.features.includes('seer-explorer-thinking-blocks') &&
    !organization?.features.includes('seer-explorer-code-mode-tools');
  const showBashModeToggle = !!organization?.features.includes(
    'seer-explorer-allow-bash-mode'
  );

  const options: Array<SelectOption<DebugOption>> = [
    ...(showContextEngineToggle
      ? [{value: 'context-engine' as const, label: t('Context Engine')}]
      : []),
    ...(showBashModeToggle
      ? [{value: 'force-bash-mode' as const, label: t('Force bash mode on')}]
      : []),
    ...(showThinkingToggle
      ? [{value: 'show-thinking' as const, label: t('Show thinking')}]
      : []),
  ];
  const value: DebugOption[] = [
    ...(showContextEngineToggle && overrideCtxEngEnable
      ? (['context-engine'] as const)
      : []),
    ...(showBashModeToggle && overrideBashModeEnabled
      ? (['force-bash-mode'] as const)
      : []),
    ...(showThinkingToggle && showThinking ? (['show-thinking'] as const) : []),
  ];

  if (options.length === 0) {
    return null;
  }

  return (
    <CompactSelect
      multiple
      options={options}
      value={value}
      onChange={selectedOptions => {
        const selectedValues = new Set(selectedOptions.map(option => option.value));
        if (
          showContextEngineToggle &&
          selectedValues.has('context-engine') !== overrideCtxEngEnable
        ) {
          onOverrideCtxEngEnableToggle();
        }
        if (
          showBashModeToggle &&
          selectedValues.has('force-bash-mode') !== overrideBashModeEnabled
        ) {
          onOverrideBashModeToggle();
        }
        if (showThinkingToggle && selectedValues.has('show-thinking') !== showThinking) {
          onShowThinkingToggle();
        }
      }}
      position="bottom-end"
      menuWidth={200}
      size="xs"
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
