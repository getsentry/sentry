import {Fragment} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {MenuListItem} from '@sentry/scraps/menuListItem';
import {CheckWrap} from '@sentry/scraps/select';

import type {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconAdd, IconCheckmark} from 'sentry/icons';
import {defined} from 'sentry/utils/defined';

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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            itemProps.__isNew__ ? (
              <Fragment>
                <IconAdd size="sm" />
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
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
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
                {data.leadingItems}
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
