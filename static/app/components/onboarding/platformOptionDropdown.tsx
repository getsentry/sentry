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
   * Whether the option is disabled
   */
  disabled?: boolean;
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
      position="bottom-end"
      disabled={disabled}
    />
  );
}

export function PlatformOptionDropdown({
  platformOptions,
  disabled,
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
      {Object.keys(platformOptions).map(key => (
        <OptionControl
          key={key}
          option={platformOptions[key]!}
          value={urlOptionValues[key]!}
          onChange={v => handleChange(key, v.value)}
          disabled={disabled}
        />
      ))}
    </Fragment>
  );
}
