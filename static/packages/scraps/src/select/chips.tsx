import {useTheme} from '@emotion/react';
import {IconClose} from '@sentry/icons/close';

import {useTranslation} from '@sentry/scraps/translation';

import type {getSelectStyles} from './styles';
import type {SelectComponents, SelectValue, StylesConfig} from './types';

export function SelectChips<TValue, TOption extends SelectValue<TValue>>({
  disabled,
  focusedChip,
  MultiValueLabel,
  onRemove,
  selectedRows,
  selectStyles,
  styles,
}: {
  focusedChip: number | null;
  onRemove: (index: number) => void;
  selectStyles: Pick<
    ReturnType<typeof getSelectStyles>,
    'chip' | 'chipLabel' | 'chipRemove' | 'chipRemoveIcon'
  >;
  selectedRows: ReadonlyArray<{option: TOption; key?: string}>;
  MultiValueLabel?: SelectComponents<TOption>['MultiValueLabel'];
  disabled?: boolean;
  styles?: StylesConfig<TValue, TOption>;
}) {
  const {t} = useTranslation();
  const theme = useTheme();

  return selectedRows.map(({option, key}, index) => {
    const optionStyle = {
      data: option,
      isDisabled: Boolean(disabled || option.disabled),
      isSelected: true,
    };
    const focusRing = index === focusedChip ? theme.focusRing() : undefined;
    return (
      <div
        key={key ?? index}
        css={
          styles?.multiValue?.({...selectStyles.chip, ...focusRing}, optionStyle) ?? {
            ...selectStyles.chip,
            ...focusRing,
          }
        }
      >
        <span
          css={
            styles?.multiValueLabel?.(selectStyles.chipLabel, optionStyle) ??
            selectStyles.chipLabel
          }
        >
          {MultiValueLabel ? (
            <MultiValueLabel option={option}>{option.label}</MultiValueLabel>
          ) : (
            option.label
          )}
        </span>
        {!disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('Remove item')}
            css={
              styles?.multiValueRemove?.(selectStyles.chipRemove, optionStyle) ??
              selectStyles.chipRemove
            }
            onMouseDown={event => event.preventDefault()}
            onClick={() => onRemove(index)}
          >
            <IconClose css={selectStyles.chipRemoveIcon} />
          </button>
        )}
      </div>
    );
  });
}
