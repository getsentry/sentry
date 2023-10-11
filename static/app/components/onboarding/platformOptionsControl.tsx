import {useMemo} from 'react';
import styled from '@emotion/styled';

import {
  BasePlatformOptions,
  PlatformOption,
  SelectedPlatformOptions,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';

/**
 * Hook that returns the currently selected platform option values from the URL
 * it will fallback to the defaultValue or the first option value if the value in the URL is not valid or not present
 */
export function useUrlPlatformOptions<PlatformOptions extends BasePlatformOptions>(
  platformOptions?: PlatformOptions
): SelectedPlatformOptions<PlatformOptions> {
  const router = useRouter();
  const {query} = router.location;

  return useMemo(() => {
    if (!platformOptions) {
      return {} as SelectedPlatformOptions<PlatformOptions>;
    }

    return Object.keys(platformOptions).reduce((acc, key) => {
      const defaultValue = platformOptions[key].defaultValue;
      const values = platformOptions[key].items.map(({value}) => value);
      acc[key as keyof PlatformOptions] = values.includes(query[key])
        ? query[key]
        : defaultValue ?? values[0];
      return acc;
    }, {} as SelectedPlatformOptions<PlatformOptions>);
  }, [platformOptions, query]);
}

type OptionControlProps = {
  /**
   * The platform options for which the control is rendered
   */
  option: PlatformOption<any>;
  /**
   * Value of the currently selected item
   */
  value: string;
  /**
   * Click handler.
   */
  onChange?: (option: string) => void;
};

function OptionControl({option, value, onChange}: OptionControlProps) {
  return (
    <SegmentedControl onChange={onChange} value={value} aria-label={option.label}>
      {option.items.map(({value: itemValue, label}) => (
        <SegmentedControl.Item key={itemValue}>{label}</SegmentedControl.Item>
      ))}
    </SegmentedControl>
  );
}

export type PlatformOptionsControlProps = {
  /**
   * Object with an option array for each platformOption
   */
  platformOptions: Record<string, PlatformOption>;
  /**
   * Object with default value for each option
   */
  defaultOptions?: Record<string, string[]>;
};

export function PlatformOptionsControl({platformOptions}: PlatformOptionsControlProps) {
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

  return (
    <Options>
      {Object.entries(platformOptions).map(([key, platformOption]) => (
        <OptionControl
          key={key}
          option={platformOption}
          value={urlOptionValues[key] ?? platformOption.items[0]?.value}
          onChange={value => handleChange(key, value)}
        />
      ))}
    </Options>
  );
}

const Options = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;
