import {memo, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {
  ChonkContentWrap,
  ChonkDetails,
  ChonkInnerWrap,
  ChonkLabel,
  ChonkLabelWrap,
  ChonkLeadingItems,
  type Priority,
} from 'sentry/components/core/menuListItem/menuListItem.chonk';
import type {TooltipProps} from 'sentry/components/core/tooltip';
import {Tooltip} from 'sentry/components/core/tooltip';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import type {FormSize} from 'sentry/utils/theme';

/**
 * A renderable item. Either a React node, or a function that accepts properties
 * of the item, and returns a React node. The function version is useful for
 * lazily rendering supplementary content like training items and tooltips.
 */
type ExtraContent =
  | React.ReactNode
  | ((state: {
      disabled: boolean;
      isFocused: boolean;
      isSelected: boolean;
    }) => React.ReactNode);

export type MenuListItemProps = {
  /**
   * Optional descriptive text. Like 'label', should preferably be a string or
   * have appropriate aria-labels.
   */
  details?: ExtraContent;
  /**
   * Whether the item is disabled (if true, the item will be grayed out and
   * non-interactive).
   */
  disabled?: boolean;
  /**
   * Item label. Should preferably be a string. If not, make sure that
   * there are appropriate aria-labels.
   */
  label?: React.ReactNode;
  /**
   * Items to be added to the left of the label
   */
  leadingItems?: ExtraContent;
  /**
   * Accented text and background (on hover) colors.
   */
  priority?: Priority;
  /**
   * Whether to show the details in an overlay when the item is hovered / focused.
   */
  showDetailsInOverlay?: boolean;
  /**
   * Determines the item's font sizes and internal paddings.
   */
  size?: FormSize;
  /**
   * Optional tooltip that appears when the use hovers over the item. This is
   * not very visible - if possible, add additional text via the `details`
   * prop instead.
   */
  tooltip?: ExtraContent;
  /**
   * Additional props to be passed into <Tooltip />.
   */
  tooltipOptions?: Omit<TooltipProps, 'children' | 'title' | 'className'>;
  /**
   * Items to be added to the right of the label.
   */
  trailingItems?: ExtraContent;
};

interface OtherProps {
  as?: React.ElementType;
  detailsProps?: Partial<React.ComponentProps<typeof Details>>;
  innerWrapProps?: Partial<React.ComponentProps<typeof InnerWrap>>;
  isFocused?: boolean;
  isPressed?: boolean;
  isSelected?: boolean;
  labelProps?: Partial<React.ComponentProps<typeof Label>>;
}

interface Props extends MenuListItemProps, OtherProps {
  ref?: React.Ref<HTMLLIElement>;
}

function BaseMenuListItem({
  label,
  details,
  as = 'li',
  priority = 'default',
  size,
  disabled = false,
  leadingItems = false,
  trailingItems = false,
  isFocused = false,
  isSelected = false,
  isPressed,
  innerWrapProps = {},
  labelProps = {},
  detailsProps = {},
  showDetailsInOverlay = false,
  tooltip,
  tooltipOptions = {delay: 500},
  ref,
  ...props
}: Props) {
  const itemRef = useRef<HTMLLIElement>(null);
  const labelId = useId();
  const detailId = useId();

  return (
    <MenuItemWrap
      aria-disabled={disabled}
      aria-labelledby={labelId}
      aria-describedby={detailId}
      as={as}
      ref={mergeRefs(ref, itemRef)}
      {...props}
    >
      <Tooltip
        skipWrapper
        title={
          typeof tooltip === 'function'
            ? tooltip({disabled, isFocused, isSelected})
            : tooltip
        }
        {...tooltipOptions}
      >
        <InnerWrap
          isFocused={isFocused}
          disabled={disabled}
          priority={priority}
          size={size}
          {...innerWrapProps}
        >
          <StyledInteractionStateLayer
            isHovered={isFocused}
            isPressed={isPressed}
            higherOpacity={priority !== 'default'}
          />
          {leadingItems && (
            <LeadingItems disabled={disabled} size={size}>
              {typeof leadingItems === 'function'
                ? leadingItems({disabled, isFocused, isSelected})
                : leadingItems}
            </LeadingItems>
          )}
          <ContentWrap isFocused={isFocused} size={size}>
            <LabelWrap>
              <Label id={labelId} data-test-id="menu-list-item-label" {...labelProps}>
                {label}
              </Label>
              {!showDetailsInOverlay && details && (
                <Details
                  id={detailId}
                  disabled={disabled}
                  priority={priority}
                  {...detailsProps}
                >
                  {typeof details === 'function'
                    ? details({disabled, isFocused, isSelected})
                    : details}
                </Details>
              )}
            </LabelWrap>
            {trailingItems && (
              <TrailingItems disabled={disabled}>
                {typeof trailingItems === 'function'
                  ? trailingItems({disabled, isFocused, isSelected})
                  : trailingItems}
              </TrailingItems>
            )}
          </ContentWrap>
        </InnerWrap>
      </Tooltip>
      {showDetailsInOverlay && details && isFocused && (
        <DetailsOverlay size={size} id={detailId} itemRef={itemRef}>
          {typeof details === 'function'
            ? details({disabled, isFocused, isSelected})
            : details}
        </DetailsOverlay>
      )}
    </MenuItemWrap>
  );
}

export const MenuListItem = memo(BaseMenuListItem);

const POPPER_OPTIONS = {
  placement: 'right-start' as const,
  strategy: 'fixed' as const,
  modifiers: [
    {
      name: 'offset',
      options: {
        offset: [-4, 8],
      },
    },
  ],
};

function DetailsOverlay({
  children,
  size,
  id,
  itemRef,
}: {
  children: React.ReactNode;
  id: string;
  itemRef: React.RefObject<HTMLLIElement | null>;
  size: Props['size'];
}) {
  const theme = useTheme();
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);

  const popper = usePopper(itemRef.current, overlayElement, POPPER_OPTIONS);

  return createPortal(
    <StyledPositionWrapper
      {...popper.attributes.popper}
      ref={setOverlayElement}
      zIndex={theme.zIndex.tooltip}
      style={popper.styles.popper}
    >
      <StyledOverlay id={id} role="tooltip" placement="right-start" size={size}>
        {children}
      </StyledOverlay>
    </StyledPositionWrapper>,
    // Safari will clip the overlay if it is inside a scrollable container, even though it is positioned fixed.
    // See https://bugs.webkit.org/show_bug.cgi?id=160953
    // To work around this, we append the overlay to the body
    document.body
  );
}

const StyledPositionWrapper = styled(PositionWrapper)`
  &[data-popper-reference-hidden='true'] {
    opacity: 0;
    pointer-events: none;
  }
`;

const StyledOverlay = styled(Overlay)<{
  size: Props['size'];
}>`
  padding: 4px;
  font-size: ${p => p.theme.form[p.size ?? 'md'].fontSize};
  cursor: auto;
  user-select: contain;
  max-height: 80vh;
  overflow: auto;
`;

const MenuItemWrap = styled('li')`
  position: static;
  list-style-type: none;
  margin: 0;
  padding: 0 ${space(0.5)};
  cursor: pointer;
  scroll-margin: ${space(0.5)} 0;

  &:focus {
    outline: none;
  }
  &:focus-visible {
    outline: none;
  }
`;

export const InnerWrap = ChonkInnerWrap;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  z-index: -1;
`;

const ContentWrap = ChonkContentWrap;

export const LeadingItems = ChonkLeadingItems;

const LabelWrap = ChonkLabelWrap;

const Label = ChonkLabel;

const Details = ChonkDetails;

const TrailingItems = styled('div')<{disabled: boolean}>`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  margin-right: ${space(0.5)};

  ${p => p.disabled && `opacity: 0.5;`}
`;
