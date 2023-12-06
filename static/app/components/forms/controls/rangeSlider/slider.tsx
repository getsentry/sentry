import styled from '@emotion/styled';

const Slider = styled('input')<{hasLabel: boolean}>`
  /* stylelint-disable-next-line property-no-vendor-prefix */
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
  margin: ${p => p.theme.grid}px 0 ${p => p.theme.grid * (p.hasLabel ? 2 : 1)}px;

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

  &::-ms-track {
    width: 100%;
    height: 3px;
    cursor: pointer;
    background: ${p => p.theme.border};
    border-radius: 3px;
    border: 0;
  }

  &::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
    transition:
      background 0.1s,
      box-shadow 0.1s;
  }

  &::-moz-range-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
    transition:
      background 0.1s,
      box-shadow 0.1s;
  }

  &::-ms-thumb {
    box-shadow: 0 0 0 3px ${p => p.theme.background};
    height: 17px;
    width: 17px;
    border-radius: 50%;
    background: ${p => p.theme.active};
    cursor: pointer;
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin-top: -7px;
    border: 0;
    transition:
      background 0.1s,
      box-shadow 0.1s;
  }

  &::-ms-fill-lower {
    background: ${p => p.theme.border};
    border: 0;
    border-radius: 50%;
  }

  &::-ms-fill-upper {
    background: ${p => p.theme.border};
    border: 0;
    border-radius: 50%;
  }

  &:focus {
    outline: none;

    &::-webkit-slider-runnable-track {
      background: ${p => p.theme.border};
    }

    &::-ms-fill-upper {
      background: ${p => p.theme.border};
    }

    &::-ms-fill-lower {
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

    &::-ms-thumb {
      background: ${p => p.theme.border};
      cursor: default;
    }

    &::-webkit-slider-runnable-track {
      cursor: default;
    }

    &::-moz-range-track {
      cursor: default;
    }

    &::-ms-track {
      cursor: default;
    }
  }

  &:not([disabled])::-webkit-slider-runnable-track:hover {
    background: ${p => p.theme.activeHover};
  }
  &:not([disabled])::-moz-range-thumb:hover {
    background: ${p => p.theme.activeHover};
  }
  &:not([disabled])::-ms-thumb:hover {
    background: ${p => p.theme.activeHover};
  }

  &:focus::-webkit-slider-thumb,
  &.focus-visible::-webkit-slider-thumb {
    box-shadow:
      ${p => p.theme.background} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
  &:focus::-moz-range-thumb,
  &.focus-visible::-moz-range-thumb {
    box-shadow:
      ${p => p.theme.background} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
  &:focus::-ms-thumb,
  &.focus-visible::-ms-thumb {
    box-shadow:
      ${p => p.theme.background} 0 0 0 3px,
      ${p => p.theme.focus} 0 0 0 6px;
  }
`;

export default Slider;
