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

  ${p => ({...getChonkButtonStyles(p)})}

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
