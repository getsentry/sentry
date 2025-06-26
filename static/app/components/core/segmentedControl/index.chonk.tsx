import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';
import {css} from '@emotion/react';

import {DO_NOT_USE_getChonkButtonStyles} from 'sentry/components/core/button/styles.chonk';
import {space} from 'sentry/styles/space';
import type {FormSize} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

export type Priority = 'default' | 'primary';

const getChildTransforms = (count: number) => {
  return Array.from(
    {length: count},
    (_, index) => css`
      label:nth-of-type(${index + 1}) {
        transform: translateX(-${index}px);
      }
    `
  );
};

export const ChonkStyledGroupWrap = chonkStyled('div')<{
  listSize: number;
  priority: Priority;
  size: FormSize;
}>`
  position: relative;
  display: inline-grid;
  grid-auto-flow: column;
  min-width: 0;

  ${p => p.theme.form[p.size]}

  & > label:first-child {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > label:not(:first-child):not(:last-child) {
    border-radius: 0;
  }

  & > label:last-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  ${p => getChildTransforms(p.listSize)}
`;

const segmentedWrapPadding = {
  md: '10px 16px 10px 16px',
  sm: '8px 12px 8px 12px',
  xs: '6px 8px 6px 8px',
} as const;

export const ChonkStyledSegmentWrap = chonkStyled('label')<{
  isSelected: boolean;
  priority: Priority;
  size: FormSize;
  isDisabled?: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  margin: 0;
  cursor: ${p => (p.isDisabled ? 'default' : 'pointer')};
  min-height: 0;
  min-width: 0;
  z-index: ${p => (p.isSelected ? 1 : undefined)};

  padding: ${p => segmentedWrapPadding[p.size]};
  font-weight: ${p => p.theme.fontWeightNormal};

  ${p => ({...DO_NOT_USE_getChonkButtonStyles({...p, disabled: p.isDisabled, priority: p.isSelected && p.priority === 'primary' ? 'primary' : 'default'})})}

  &:has(input:focus-visible) {
    ${p => p.theme.focusRing};

    /* Hide fallback ring when :has works */
    span {
      box-shadow: none !important;
    }
  }

  /* Fallback ring (for Firefox, where :has doesn't work) */
  input:focus-visible + span {
    ${({theme}) => theme.focusRing};
  }
`;

export const ChonkStyledVisibleLabel = chonkStyled('span')`
  ${p => p.theme.overflowEllipsis}
  user-select: none;
  font-weight: ${p => p.theme.fontWeightBold};
  text-align: center;
`;

function getTextColor({
  isSelected,
  priority,
  theme,
}: {
  isSelected: boolean;
  priority: Priority;
  theme: DO_NOT_USE_ChonkTheme;
  isDisabled?: boolean;
}) {
  if (isSelected) {
    return priority === 'default' ? theme.colors.blue500 : undefined;
  }

  return theme.subText;
}

export const ChonkStyledLabelWrap = chonkStyled('span')<{
  isSelected: boolean;
  priority: Priority;
  size: FormSize;
}>`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: ${p => (p.size === 'xs' ? space(0.5) : space(0.75))};
  z-index: 1;
  color: ${p => getTextColor(p)};
`;
