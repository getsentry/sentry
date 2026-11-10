import {useMemo} from 'react';
import {parseAsString, useQueryStates} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import type {
  BasePlatformOptions,
  PlatformOption,
  SelectedPlatformOptions,
} from './gettingStartedDoc/types';

export function usePlatformOptionsQueryStates(platformOptions?: BasePlatformOptions) {
  return useQueryStates(
    Object.fromEntries(
      Object.keys(platformOptions ?? {}).map(key => [key, parseAsString])
    )
  );
}

/**
 * Hook that returns the currently selected platform option values from the URL
 * it will fallback to the defaultValue or the first option value if the value in the URL is not valid or not present
 */
export function useUrlPlatformOptions<PlatformOptions extends BasePlatformOptions>(
  platformOptions?: PlatformOptions
): SelectedPlatformOptions<PlatformOptions> {
  const [query] = usePlatformOptionsQueryStates(platformOptions);

  return useMemo(() => {
    if (!platformOptions) {
      return {} as SelectedPlatformOptions<PlatformOptions>;
    }

    return Object.keys(platformOptions).reduce((acc, key) => {
      const defaultValue = platformOptions[key]!.defaultValue;
      const values = platformOptions[key]!.items.map(({value}) => value);
      const queryValue = query[key];
      acc[key as keyof PlatformOptions] =
        typeof queryValue === 'string' && values.includes(queryValue)
          ? queryValue
          : (defaultValue ?? values[0]!);
      return acc;
    }, {} as SelectedPlatformOptions<PlatformOptions>);
  }, [platformOptions, query]);
}

type OptionControlProps = {
  /**
   * Click handler.
   */
  onChange: (option: string) => void;
  /**
   * The platform options for which the control is rendered
   */
  option: PlatformOption<any>;
  /**
   * Value of the currently selected item
   */
  value: string;
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

type PlatformOptionsControlProps = {
  /**
   * Object with an option array for each platformOption
   */
  platformOptions: Record<string, PlatformOption>;
  /**
   * Fired when the value changes
   */
  onChange?: (options: SelectedPlatformOptions) => void;
};

export function PlatformOptionsControl({
  platformOptions,
  onChange,
}: PlatformOptionsControlProps) {
  const [, setPlatformOptionsQuery] = usePlatformOptionsQueryStates(platformOptions);
  const urlOptionValues = useUrlPlatformOptions(platformOptions);

  const handleChange = (key: string, value: string) => {
    onChange?.({[key]: value});
    setPlatformOptionsQuery({[key]: value});
  };

  return (
    <Flex wrap="wrap" gap="md">
      {Object.entries(platformOptions).map(([key, platformOption]) => (
        <OptionControl
          key={key}
          option={platformOption}
          value={urlOptionValues[key] ?? platformOption.items[0]?.value!}
          onChange={value => handleChange(key, value)}
        />
      ))}
    </Flex>
  );
}
