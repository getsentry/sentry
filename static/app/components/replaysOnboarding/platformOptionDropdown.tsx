import {Fragment} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t} from 'sentry/locale';
import useRouter from 'sentry/utils/useRouter';

export type OptionControlProps = {
  /**
   * The platform options for which the control is rendered
   */
  option: PlatformOption<any>;
  /**
   * Value of the currently selected item
   */
  value: string;
  /**
   * Whether the option is disabled
   */
  disabled?: boolean;
  /**
   * Click handler
   */
  onChange?: (selectedOption: SelectOption<string>) => void;
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
  return (
    <CompactSelect
      triggerLabel={
        option.items.find(v => v.value === value)?.label ?? option.items[0]!.label
      }
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
  const router = useRouter();
  const urlOptionValues = useUrlPlatformOptions(platformOptions);

  const handleChange = (key: string, value: string) => {
    router.replace({
      ...router.location,
      query: {
        ...router.location.query,
        [key]: value,
      },
    });
  };

  const platforms = platformOptions.siblingOption ?? platformOptions.packageManager;

  if (!platforms) {
    return null;
  }

  return (
    <Fragment>
      {t('with')}
      <OptionControl
        key="platformOption"
        option={platforms}
        value={urlOptionValues.siblingOption ?? platforms.items[0]?.label}
        onChange={v => handleChange('siblingOption', v.value)}
        disabled={disabled}
      />
    </Fragment>
  );
}
