import type * as React from 'react';
import {Fragment, useRef} from 'react';
import {ClassNames, type CSSObject} from '@emotion/react';
import {useListBoxSection, useOption} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import {IconAdd} from '@sentry/icons/add';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {ListItem, SectionGroup, SectionList} from '@sentry/scraps/menu';
import type {FormSize} from '@sentry/scraps/theme';
import type {VirtualRow} from '@sentry/scraps/useVirtualCollection';

import {CheckWrap} from './styles';
import type {SelectComponents, SelectValue, StylesConfig} from './types';

export function SelectOption<TValue, TOption extends SelectValue<TValue>>({
  row,
  state,
  option,
  size,
  multiple,
  virtualized,
  showDividers,
  showCreateOptionIcon,
  OptionLabel,
  styleOption,
  create,
}: {
  create: boolean;
  multiple: boolean;
  option: TOption | undefined;
  row: VirtualRow<unknown>;
  size: FormSize;
  state: ListState<unknown>;
  virtualized: boolean;
  OptionLabel?: SelectComponents<TOption>['OptionLabel'];
  showCreateOptionIcon?: boolean;
  showDividers?: boolean;
  styleOption?: StylesConfig<TValue, TOption>['option'];
}) {
  const ref = useRef<HTMLLIElement>(null);
  const {
    optionProps,
    labelProps,
    descriptionProps,
    isSelected,
    isFocused,
    isPressed,
    isDisabled,
  } = useOption(
    {key: row.node.key, isVirtualized: virtualized, shouldUseVirtualFocus: true},
    state,
    ref
  );
  const leading =
    typeof option?.leadingItems === 'function'
      ? option.leadingItems({disabled: isDisabled, isFocused, isSelected})
      : option?.leadingItems;
  const label =
    OptionLabel && option ? <OptionLabel option={option} /> : row.node.rendered;

  return (
    <ClassNames>
      {({css, cx}) => (
        <ListItem
          {...option}
          {...mergeProps(optionProps, {
            onClick: (event: React.MouseEvent) => event.preventDefault(),
          })}
          {...row.props}
          ref={mergeRefs<HTMLLIElement>(ref, row.props?.ref)}
          {...{
            className: cx(
              {
                option: true,
                'option--is-selected': isSelected,
                'option--is-focused': isFocused,
                'option--is-disabled': isDisabled,
              },
              option &&
                styleOption &&
                css(styleOption({}, {data: option, isDisabled, isSelected}))
            ),
          }}
          data-test-id={option?.value == null ? undefined : String(option.value)}
          label={label}
          labelProps={labelProps}
          detailsProps={descriptionProps}
          disabled={isDisabled}
          isFocused={isFocused}
          isSelected={isSelected}
          isPressed={isPressed}
          {...{showDivider: showDividers}}
          size={size}
          leadingItems={
            <Fragment>
              {create && showCreateOptionIcon !== false ? (
                <IconAdd size="sm" />
              ) : (
                <CheckWrap
                  aria-hidden="true"
                  isMultiple={multiple}
                  isSelected={isSelected}
                  size={size}
                >
                  {isSelected && <IconCheckmark size={multiple ? 'xs' : 'sm'} />}
                </CheckWrap>
              )}
              {leading}
            </Fragment>
          }
        />
      )}
    </ClassNames>
  );
}

export function SelectSection({
  row,
  headingStyle,
  children,
}: {
  children: React.ReactNode;
  headingStyle: CSSObject;
  row: VirtualRow<unknown>;
}) {
  const heading = row.node.rendered;
  const {itemProps, headingProps, groupProps} = useListBoxSection({heading});
  return (
    <SectionGroup {...itemProps}>
      <div {...row.props}>
        {heading && (
          <div {...headingProps} css={headingStyle}>
            {heading}
          </div>
        )}
      </div>
      <SectionList {...groupProps}>{children}</SectionList>
    </SectionGroup>
  );
}
