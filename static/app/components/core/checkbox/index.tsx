import {forwardRef, useCallback} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import mergeRefs from 'sentry/utils/mergeRefs';
import type {FormSize} from 'sentry/utils/theme';
import {withChonk} from 'sentry/utils/theme/withChonk';

import * as ChonkCheckbox from './index.chonk';

type CheckboxConfig = {
  borderRadius: string;
  box: string;
  icon: string;
};

const checkboxSizeMap: Record<FormSize, CheckboxConfig> = {
  xs: {box: '12px', borderRadius: '2px', icon: '10px'},
  sm: {box: '16px', borderRadius: '4px', icon: '12px'},
  md: {box: '22px', borderRadius: '6px', icon: '18px'},
};

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'size'> {
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: React.InputHTMLAttributes<HTMLInputElement>['checked'] | 'indeterminate';
  /**
   * The size of the checkbox. Defaults to 'sm'.
   */
  size?: FormSize;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({checked = false, size = 'sm', className, ...props}, ref) => {
    const nativeCheckBoxRef = useCallback(
      (node: HTMLInputElement | null) => {
        if (node) {
          node.indeterminate = checked === 'indeterminate';
        }
      },
      [checked]
    );

    const wrapperProps: React.HTMLAttributes<HTMLDivElement> = {
      className,
      style: props.style,
    };

    return (
      <CheckboxWrapper size={size} {...wrapperProps}>
        <NativeHiddenCheckbox
          ref={mergeRefs([nativeCheckBoxRef, ref])}
          checked={checked !== 'indeterminate' && checked}
          type="checkbox"
          {...props}
        />

        <FakeCheckbox aria-hidden size={size}>
          {(checked === true || checked === 'indeterminate') && (
            <CheckboxIcon viewBox="0 0 16 16" size={checkboxSizeMap[size].icon}>
              {checked === 'indeterminate' ? (
                <path d="M3 8H13" />
              ) : (
                <path d="M2.86 9.14C4.42 10.7 6.9 13.14 6.86 13.14L12.57 3.43" />
              )}
            </CheckboxIcon>
          )}
        </FakeCheckbox>
        {!props.disabled && (
          <InteractionStateLayer
            higherOpacity={checked === true || checked === 'indeterminate'}
          />
        )}
      </CheckboxWrapper>
    );
  }
);

const CheckboxWrapper = styled('div')<{
  size: FormSize;
}>`
  position: relative;
  cursor: pointer;
  display: inline-flex;
  justify-content: flex-start;
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
`;

const NativeHiddenCheckbox = withChonk(
  styled('input')`
    position: absolute;
    opacity: 0;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    cursor: pointer;

    & + * {
      box-shadow: ${p => p.theme.dropShadowMedium} inset;
      color: ${p => p.theme.textColor};
      border: 1px solid ${p => p.theme.gray200};

      svg {
        stroke: ${p => p.theme.white};
      }
    }

    &:focus-visible + * {
      box-shadow: ${p => p.theme.focusBorder} 0 0 0 1px;
    }

    &:checked:focus-visible + *,
    &:indeterminate:focus-visible + * {
      box-shadow: ${p => p.theme.focus} 0 0 0 3px;
    }

    &:disabled + * {
      background-color: ${p => p.theme.backgroundSecondary};
      border: 1px solid ${p => p.theme.disabledBorder};
    }

    &:checked + *,
    &:indeterminate + * {
      background-color: ${p => p.theme.active};
      color: ${p => p.theme.white};
    }

    &:disabled:checked + *,
    &:disabled:indeterminate + * {
      background-color: ${p => p.theme.disabled};
      border: 1px solid ${p => p.theme.disabledBorder};
    }
  `,
  ChonkCheckbox.ChonkNativeHiddenCheckbox
);

const FakeCheckbox = styled('div')<{
  size: FormSize;
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  width: ${p => checkboxSizeMap[p.size].box};
  height: ${p => checkboxSizeMap[p.size].box};
  border-radius: ${p => checkboxSizeMap[p.size].borderRadius};
  pointer-events: none;
`;

const CheckboxIcon = styled('svg')<{size: string}>`
  width: ${p => p.size};
  height: ${p => p.size};

  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: calc(1.4px + ${p => p.size} * 0.04);
`;
