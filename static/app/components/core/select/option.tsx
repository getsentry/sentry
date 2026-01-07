import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {CheckWrap} from '@sentry/scraps/select';

import {MenuListItem} from 'sentry/components/core/menuListItem';
import type {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconAdd, IconCheckmark} from 'sentry/icons';
import {defined} from 'sentry/utils';

type Props = React.ComponentProps<typeof selectComponents.Option>;

export function SelectOption(props: Props) {
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
  const {showDividers, size} = selectProps;
  const {value, selectionMode, priority, ...itemProps} = data;

  const isMultiple = defined(selectionMode) ? selectionMode === 'multiple' : isMulti;

  // Unless the priority prop is explicitly defined, use 'default' for all items.
  const itemPriority = priority ?? 'default';

  return (
    <ClassNames>
      {({cx}) => (
        <MenuListItem
          {...itemProps}
          {...innerProps}
          role={isMultiple ? 'menuitemcheckbox' : 'menuitemradio'}
          aria-checked={isSelected}
          ref={innerRef}
          className={cx({
            option: true,
            'option--is-disabled': isDisabled,
            'option--is-focused': isFocused,
            'option--is-selected': isSelected,
          })}
          as="div"
          value={value}
          label={label}
          disabled={isDisabled}
          isFocused={isFocused}
          showDivider={showDividers}
          priority={itemPriority}
          size={size}
          innerWrapProps={{'data-test-id': value}}
          labelProps={{as: typeof label === 'string' ? 'p' : 'div'}}
          leadingItems={
            itemProps.__isNew__ ? (
              <Fragment>
                <IconAdd size="sm" />
                {data.leadingItems}
              </Fragment>
            ) : (
              <Fragment>
                <CheckWrap isMultiple={isMultiple} isSelected={isSelected} size={size}>
                  {isSelected && (
                    <StyledIconCheckmark
                      size={isMultiple ? 'xs' : 'sm'}
                      isMultiple={isMultiple}
                    />
                  )}
                </CheckWrap>
                {data.leadingItems}
              </Fragment>
            )
          }
        />
      )}
    </ClassNames>
  );
}

const StyledIconCheckmark = styled(IconCheckmark)<{isMultiple: boolean}>`
  color: ${p => (p.isMultiple ? p.theme.colors.white : undefined)};
`;
