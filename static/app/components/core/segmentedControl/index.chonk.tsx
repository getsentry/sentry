import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import {getChonkButtonStyles} from 'sentry/components/core/button/index.chonk';
import type {FormSize} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

export type Priority = 'default' | 'primary';

export const ChonkStyledGroupWrap = chonkStyled('div')<{
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

    &::after {
      border-left: none;
      border-right: none;
    }
  }

  & > label:last-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

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

  ${p => p.theme.buttonPadding[p.size]}
  font-weight: ${p => p.theme.fontWeightNormal};

  ${p => ({...getChonkButtonStyles({...p, priority: p.isSelected && p.priority === 'primary' ? 'primary' : 'default'})})}

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

  ${p => p.isSelected && `z-index: 1;`}
`;

export const ChonkStyledVisibleLabel = chonkStyled('span')<{
  isSelected: boolean;
  priority: Priority;
  isDisabled?: boolean;
}>`
${p => p.theme.overflowEllipsis}
  user-select: none;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-align: center;
  color: ${p => getTextColor(p)};
`;

function getTextColor({
  isDisabled,
  isSelected,
  priority,
  theme,
}: {
  isSelected: boolean;
  priority: Priority;
  theme: DO_NOT_USE_ChonkTheme;
  isDisabled?: boolean;
}) {
  if (isDisabled) {
    return theme.subText;
  }

  if (isSelected) {
    return priority === 'default' ? theme.colors.blue500 : undefined;
  }

  return theme.subText;
}
