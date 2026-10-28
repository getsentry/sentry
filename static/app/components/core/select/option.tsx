import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {ListItem} from '@sentry/scraps/menu';
import type {SelectValue} from '@sentry/scraps/select/types';
import type {FormSize} from '@sentry/scraps/theme';

import {defined} from 'sentry/utils/defined';

import type {components as selectComponents} from './reactSelectWrapper';
import type {BaseSelectProps} from './select';
import {CheckWrap} from './styles';

type Props<TValue, TOption extends SelectValue<TValue>> = Omit<
  React.ComponentProps<typeof selectComponents.Option>,
  'selectProps' | 'data'
> & {
  data: TOption & {__isNew__?: boolean; selectionMode?: 'single' | 'multiple'};
  selectProps: Pick<
    BaseSelectProps<TValue, TOption>,
    'optionHeight' | 'renderOptionLabel' | 'showCreateOptionIcon' | 'showDividers'
  > & {size?: FormSize};
};

export function SelectOption<TValue, TOption extends SelectValue<TValue>>(
  props: Props<TValue, TOption>
) {
  const {
    label,
    data,
    selectProps,
    isMulti,
    isSelected,
    isFocused,
    isDisabled,
    innerProps,
    innerRef,
  } = props;
  const {showDividers, size = 'md'} = selectProps;
  const leadingItems =
    typeof data.leadingItems === 'function'
      ? data.leadingItems({disabled: isDisabled, isFocused, isSelected})
      : data.leadingItems;
  const renderedLabel = selectProps.renderOptionLabel
    ? selectProps.renderOptionLabel(data)
    : label;
  const {value, selectionMode, priority, ...itemProps} = data;

  const isMultiple = defined(selectionMode) ? selectionMode === 'multiple' : isMulti;

  // Unless the priority prop is explicitly defined, use 'default' for all items.
  const itemPriority = priority ?? 'default';

  return (
    <ClassNames>
      {({cx}) => (
        <ListItem
          {...itemProps}
          {...{
            ...innerProps,
            role: isMultiple ? 'menuitemcheckbox' : 'menuitemradio',
            'aria-checked': isSelected,
            className: cx({
              option: true,
              'option--is-disabled': isDisabled,
              'option--is-focused': isFocused,
              'option--is-selected': isSelected,
            }),
            value,
            showDivider: showDividers,
          }}
          ref={innerRef}
          as="div"
          label={renderedLabel}
          disabled={isDisabled}
          isFocused={isFocused}
          priority={itemPriority}
          size={size}
          innerWrapProps={{'data-test-id': defined(value) ? String(value) : undefined}}
          labelProps={{as: typeof renderedLabel === 'string' ? 'p' : 'div'}}
          leadingItems={
            itemProps.__isNew__ && selectProps.showCreateOptionIcon !== false ? (
              <Fragment>
                <IconAdd size="sm" />
                {leadingItems}
              </Fragment>
            ) : (
              <Fragment>
                <CheckWrap
                  style={
                    selectProps.optionHeight
                      ? {height: selectProps.optionHeight}
                      : undefined
                  }
                  isMultiple={isMultiple}
                  isSelected={isSelected}
                  size={size}
                >
                  {isSelected && (
                    <StyledIconCheckmark
                      size={isMultiple ? 'xs' : 'sm'}
                      isMultiple={isMultiple}
                    />
                  )}
                </CheckWrap>

                {leadingItems}
              </Fragment>
            )
          }
        />
      )}
    </ClassNames>
  );
}

const StyledIconCheckmark = styled(IconCheckmark, {
  shouldForwardProp: prop => prop !== 'isMultiple',
})<{isMultiple: boolean}>`
  color: ${p => (p.isMultiple ? p.theme.colors.white : undefined)};
`;
