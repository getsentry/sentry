import styled from '@emotion/styled';

import {withChonk} from 'sentry/utils/theme/withChonk';

import {Slider as ChonkSlider} from './slider.chonk';

interface BaseProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'defaultValue'
  > {
  defaultValue?: number;
  /** Optional callback to format the label */
  formatLabel?: (value: number | '') => React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

interface ControlledProps extends BaseProps {
  onChange: (value: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  value: number | '';
}

interface UncontrolledProps extends BaseProps {
  defaultValue?: number;
  onChange?: never;
  value?: never;
}

export type SliderProps = ControlledProps | UncontrolledProps;

function LegacySlider({ref, ...props}: SliderProps) {
  return (
    <StyledSlider
      ref={ref}
      type="range"
      {...props}
      onChange={e => props.onChange?.(e.currentTarget.valueAsNumber, e)}
    />
  );
}

export const Slider = withChonk(LegacySlider, ChonkSlider);

const StyledSlider = styled('input')<React.InputHTMLAttributes<HTMLInputElement>>`
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: transparent;

  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-moz-range-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.tokens.background.primary};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
    margin-top: -7px;
    border: 0;
    transition:
      background 0.1s,
      box-shadow 0.1s;
  }

  &::-moz-range-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.tokens.background.primary};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    appearance: none;
    margin-top: -7px;
    border: 0;
    transition:
      background 0.1s,
      box-shadow 0.1s;
  }
  &:focus {
    outline: none;

    &::-webkit-slider-runnable-track {
      background: ${p => p.theme.border};
    }
  }

  &[disabled] {
    &::-webkit-slider-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }
    &::-moz-range-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }

    &::-webkit-slider-runnable-track {
      cursor: default;
    }
    &::-moz-range-track {
      cursor: default;
    }
  }

  &:not([disabled])::-webkit-slider-runnable-track:hover {
    background: ${p => p.theme.activeHover};
  }
  &:not([disabled])::-moz-range-track:hover {
    background: ${p => p.theme.activeHover};
  }

  &:focus::-webkit-slider-thumb {
    box-shadow:
      ${p => p.theme.tokens.background.primary} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
  &:focus-visible::-webkit-slider-thumb {
    box-shadow:
      ${p => p.theme.tokens.background.primary} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
  &:focus::-moz-range-thumb {
    box-shadow:
      ${p => p.theme.tokens.background.primary} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
  &:focus-visible::-moz-range-thumb {
    box-shadow:
      ${p => p.theme.tokens.background.primary} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
`;
