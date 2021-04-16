import {DurationDisplay} from 'app/components/waterfallTree/types';
import space from 'app/styles/space';

type HatchProps = {
  spanBarHatch: boolean;
};

export function getHatchPattern(
  {spanBarHatch}: HatchProps,
  primary: string,
  alternate: string
) {
  if (spanBarHatch === true) {
    return `
      background-image: linear-gradient(135deg,
        ${alternate},
        ${alternate} 2.5px,
        ${primary} 2.5px,
        ${primary} 5px,
        ${alternate} 6px,
        ${alternate} 8px,
        ${primary} 8px,
        ${primary} 11px,
        ${alternate} 11px,
        ${alternate} 14px,
        ${primary} 14px,
        ${primary} 16.5px,
        ${alternate} 16.5px,
        ${alternate} 19px,
        ${primary} 20px
      );
      background-size: 16px 16px;
    `;
  }

  return null;
}

export const getDurationPillAlignment = ({
  durationDisplay,
  theme,
  spanBarHatch,
}: {
  durationDisplay: DurationDisplay;
  theme: any;
  spanBarHatch: boolean;
}) => {
  switch (durationDisplay) {
    case 'left':
      return `right: calc(100% + ${space(0.5)});`;
    case 'right':
      return `left: calc(100% + ${space(0.75)});`;
    default:
      return `
        right: ${space(0.75)};
        color: ${spanBarHatch === true ? theme.gray300 : theme.white};
      `;
  }
};

export const getToggleTheme = ({
  isExpanded,
  theme,
  disabled,
}: {
  isExpanded: boolean;
  theme: any;
  disabled: boolean;
}) => {
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;

  if (disabled) {
    return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.border};
    color: ${buttonTheme.color};
    cursor: default;
  `;
  }

  return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.border};
    color: ${buttonTheme.color};
  `;
};

export const getDurationDisplay = ({
  width,
  left,
}: {
  width: undefined | number;
  left: undefined | number;
}): DurationDisplay => {
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }
  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }
  if (left > spaceNeeded) {
    return 'left';
  }
  return 'inset';
};
