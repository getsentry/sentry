import {forwardRef as reactForwardRef} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

/**
 * Menu item priority. Currently there's only one option other than default,
 * but we may choose to add more in the future.
 */
type Priority = 'danger' | 'default';

export type MenuListItemProps = {
  /**
   * Optional descriptive text. Like 'label', should preferably be a string or
   * have appropriate aria-labels.
   */
  details?: React.ReactNode;
  /**
   * Item label. Should prefereably be a string. If not, make sure that
   * there are appropriate aria-labels.
   */
  label?: React.ReactNode;
  /*
   * Items to be added to the left of the label
   */
  leadingItems?: React.ReactNode;
  /*
   * Whether leading items should be centered with respect to the entire
   * height of the item. If false (default), they will be centered with
   * respect to the first line of the label element.
   */
  leadingItemsSpanFullHeight?: boolean;
  /**
   * Accented text and background (on hover) colors.
   */
  priority?: Priority;
  /**
   * Whether to show a line divider below this item
   */
  showDivider?: boolean;
  /*
   * Items to be added to the right of the label.
   */
  trailingItems?: React.ReactNode;
  /*
   * Whether trailing items should be centered wrt/ the entire height of the
   * item. If false (default), they will be centered wrt/ the first line of
   * the label element.
   */
  trailingItemsSpanFullHeight?: boolean;
};

type OtherProps = {
  as?: React.ElementType;
  detailsProps?: object;
  innerWrapProps?: object;
  isDisabled?: boolean;
  isFocused?: boolean;
  labelProps?: object;
};

type Props = MenuListItemProps &
  OtherProps & {
    forwardRef: React.ForwardedRef<HTMLLIElement>;
  };

function BaseMenuListItem({
  label,
  details,
  as = 'li',
  priority = 'default',
  showDivider = false,
  leadingItems = false,
  leadingItemsSpanFullHeight = false,
  trailingItems = false,
  trailingItemsSpanFullHeight = false,
  isFocused = false,
  isDisabled = false,
  innerWrapProps = {},
  labelProps = {},
  detailsProps = {},
  forwardRef,
  ...props
}: Props) {
  return (
    <MenuItemWrap as={as} ref={forwardRef} {...props}>
      <InnerWrap
        isDisabled={isDisabled}
        isFocused={isFocused}
        priority={priority}
        {...innerWrapProps}
      >
        <ContentWrap isFocused={isFocused} showDivider={showDivider}>
          {leadingItems && (
            <LeadingItems
              isDisabled={isDisabled}
              spanFullHeight={leadingItemsSpanFullHeight}
            >
              {leadingItems}
            </LeadingItems>
          )}
          <LabelWrap>
            <Label aria-hidden="true" {...labelProps}>
              {label}
            </Label>
            {details && (
              <Details isDisabled={isDisabled} priority={priority} {...detailsProps}>
                {details}
              </Details>
            )}
          </LabelWrap>
          {trailingItems && (
            <TrailingItems
              isDisabled={isDisabled}
              spanFullHeight={trailingItemsSpanFullHeight}
            >
              {trailingItems}
            </TrailingItems>
          )}
        </ContentWrap>
      </InnerWrap>
    </MenuItemWrap>
  );
}

const MenuListItem = reactForwardRef<HTMLLIElement, MenuListItemProps & OtherProps>(
  (props, ref) => <BaseMenuListItem {...props} forwardRef={ref} />
);

export default MenuListItem;

const MenuItemWrap = styled('li')`
  position: static;
  list-style-type: none;
  margin: 0;
  padding: 0 ${space(0.5)};
  cursor: pointer;

  &:focus {
    outline: none;
  }
  &:focus-visible {
    outline: none;
  }
`;

export const InnerWrap = styled('div', {
  shouldForwardProp: prop =>
    typeof prop === 'string' &&
    isPropValid(prop) &&
    !['isDisabled', 'isFocused', 'priority'].includes(prop),
})<{
  isDisabled: boolean;
  isFocused: boolean;
  priority: Priority;
}>`
  display: flex;
  position: relative;
  padding: 0 ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;

  &,
  &:hover {
    color: ${p => p.theme.textColor};
  }
  ${p => p.priority === 'danger' && `&,&:hover {color: ${p.theme.errorText}}`}
  ${p =>
    p.isDisabled &&
    `
    &, &:hover {
      color: ${p.theme.subText};
      cursor: initial;
    }
  `}

  ${p =>
    p.isFocused &&
    `
      background: ${p.priority === 'danger' ? p.theme.red100 : p.theme.hover};
      z-index: 1;
    `}
`;

const ContentWrap = styled('div')<{isFocused: boolean; showDivider: boolean}>`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  padding: ${space(1)} 0;
  margin-left: ${space(0.5)};

  ${p =>
    p.showDivider &&
    !p.isFocused &&
    `
      &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 1px;
        box-shadow:  0 1px 0 0 ${p.theme.innerBorder};
      }
    `}
`;

const LeadingItems = styled('div')<{isDisabled: boolean; spanFullHeight: boolean}>`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  padding: ${space(1)} 0;

  ${p => p.isDisabled && `opacity: 0.5;`}
  ${p => p.spanFullHeight && `height: 100%;`}
`;

const LabelWrap = styled('div')`
  padding-right: ${space(1)};
  width: 100%;
`;

const Label = styled('p')`
  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;
  ${overflowEllipsis}
`;

const Details = styled('p')<{isDisabled: boolean; priority: Priority}>`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.2;
  margin-bottom: 0;
  ${overflowEllipsis}

  ${p => p.priority === 'danger' && `color: ${p.theme.errorText};`}
  ${p => p.isDisabled && `color: ${p.theme.subText};`}
`;

const TrailingItems = styled('div')<{isDisabled: boolean; spanFullHeight: boolean}>`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  margin-right: ${space(0.5)};

  ${p => p.isDisabled && `opacity: 0.5;`}
  ${p => p.spanFullHeight && `height: 100%;`}
`;
