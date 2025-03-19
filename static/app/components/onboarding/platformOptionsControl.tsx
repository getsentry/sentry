import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {
  BasePlatformOptions,
  PlatformOption,
  SelectedPlatformOptions,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ExternalLink from 'sentry/components/links/externalLink';
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
      const defaultValue = platformOptions[key]!.defaultValue;
      const values = platformOptions[key]!.items.map(({value}) => value);
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
  /**
   * Whether the option is disabled
   */
  disabled?: boolean;
};

function OptionControl({option, value, onChange, disabled}: OptionControlProps) {
  const tooltipContent = option.tooltip && (
    <TooltipContent>
      <div>{option.tooltip.description}</div>
      {option.tooltip.link && (
        <ExternalLink href={option.tooltip.link}>Learn more</ExternalLink>
      )}
    </TooltipContent>
  );

  return (
    <ControlWrapper>
      <ControlLabel>
        {option.label}
        {option.tooltip && <StyledQuestionTooltip size="sm" title={tooltipContent} />}
      </ControlLabel>
      <StyledSegmentedControl
        onChange={onChange}
        value={value}
        aria-label={option.label}
        disabled={disabled}
      >
        {option.items.map(({value: itemValue, label}) => (
          <SegmentedControl.Item key={itemValue}>{label}</SegmentedControl.Item>
        ))}
      </StyledSegmentedControl>
    </ControlWrapper>
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
  /**
   * Fired when the value changes
   */
  onChange?: (options: SelectedPlatformOptions) => void;
  /**
   * Map of platform option keys to whether they should be disabled
   */
  disabledOptions?: Record<string, boolean>;
};

export function PlatformOptionsControl({
  platformOptions,
  onChange,
  disabledOptions = {},
}: PlatformOptionsControlProps) {
  const router = useRouter();
  const urlOptionValues = useUrlPlatformOptions(platformOptions);

  const handleChange = (key: string, value: string) => {
    onChange?.({[key]: value});
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
          value={urlOptionValues[key] ?? (platformOption.items[0]?.value as string)}
          onChange={value => handleChange(key, value)}
          disabled={disabledOptions[key]}
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

const ControlWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ControlLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  color: ${p => p.theme.subText};
`;

const TooltipContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  max-width: 250px;
`;

const StyledSegmentedControl = styled(SegmentedControl)`
  opacity: ${p => p.disabled && '0.4'};
  filter: ${p => p.disabled && 'grayscale(50%)'};
  transition:
    opacity 0.2s ease-in-out,
    filter 0.2s ease-in-out;
`;
