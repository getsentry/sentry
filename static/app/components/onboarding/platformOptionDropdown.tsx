import {Fragment} from 'react';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type OptionControlProps = {
  onChange: (selectedOption: SelectOption<string>) => void;
  option: PlatformOption<any>;
  value: string;
  disabled?: boolean;
};

type PlatformOptionsControlProps = {
  /**
   * Object with an option array for each platformOption
   */
  platformOptions: Record<string, PlatformOption>;
  /**
   * Optional connector word rendered before a given option's control, keyed by
   * option key. Lets callers compose a readable sentence, e.g. rendering "on"
   * between two selectors so it reads "with <integration> on <runtime>".
   */
  connectors?: Record<string, string>;
  /**
   * Whether the option is disabled
   */
  disabled?: boolean;
  /**
   * Option values pinned by another selection, keyed by option key. A locked
   * option renders the given value and is disabled, e.g. a Cloudflare-only SDK
   * pins the runtime selector to "cloudflare".
   */
  lockedValues?: Record<string, string>;
};

function OptionControl({option, value, onChange, disabled}: OptionControlProps) {
  const selectedItem = option.items.find(v => v.value === value) ?? option.items[0]!;
  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps}>
          <Flex align="center" gap="sm">
            {selectedItem.leadingItems}
            {selectedItem.label}
          </Flex>
        </OverlayTrigger.Button>
      )}
      value={value}
      onChange={onChange}
      options={option.items}
      // Anchor the menu's left edge to the trigger and grow rightward. Paired
      // with menuWidth below, a menu wider than the trigger extends right rather
      // than hanging off to the left.
      position="bottom-start"
      // Size the menu to its widest option so long SDK names (e.g. "Cloudflare
      // Agents SDK") aren't truncated. min-width:100% still keeps it at least as
      // wide as the trigger for short lists.
      menuWidth="max-content"
      disabled={disabled}
    />
  );
}

export function PlatformOptionDropdown({
  platformOptions,
  disabled,
  connectors,
  lockedValues,
}: PlatformOptionsControlProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const urlOptionValues = useUrlPlatformOptions(platformOptions);

  const handleChange = (key: string, value: string) => {
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          [key]: value,
        },
      },
      {replace: true}
    );
  };

  if (Object.keys(platformOptions).length === 0) {
    return null;
  }

  return (
    <Fragment>
      {t('with')}
      {Object.keys(platformOptions).map(key => {
        const lockedValue = lockedValues?.[key];
        return (
          <Fragment key={key}>
            {connectors?.[key]}
            <OptionControl
              option={platformOptions[key]!}
              value={lockedValue ?? urlOptionValues[key]!}
              onChange={v => handleChange(key, v.value)}
              disabled={disabled || lockedValue !== undefined}
            />
          </Fragment>
        );
      })}
    </Fragment>
  );
}
