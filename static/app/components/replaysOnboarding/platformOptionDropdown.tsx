import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  PlatformOptionsControlProps,
  useUrlPlatformOptions,
} from 'sentry/components/onboarding/platformOptionsControl';
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
   * Click handler
   */
  onChange?: (selectedOption: SelectOption<string>) => void;
};

function OptionControl({option, value, onChange}: OptionControlProps) {
  return (
    <CompactSelect
      triggerLabel={
        option.items.find(v => v.value === value)?.label ?? option.items[0].label
      }
      value={value}
      onChange={onChange}
      options={option.items}
      position="bottom-end"
    />
  );
}

export function PlatformOptionDropdown({platformOptions}: PlatformOptionsControlProps) {
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

  return (
    <OptionControl
      key="platformOption"
      option={platforms}
      value={urlOptionValues.siblingOption ?? platforms.items[0]?.label}
      onChange={v => handleChange('siblingOption', v.value)}
    />
  );
}
