import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {components as selectComponents, OptionTypeBase} from 'react-select';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {FocusScope} from '@react-aria/focus';
import {useMenuTrigger} from '@react-aria/menu';
import {useResizeObserver} from '@react-aria/utils';

import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import SelectControl, {
  ControlProps,
  GeneralSelectValue,
} from 'sentry/components/forms/controls/selectControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import space from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';
import useOverlay, {UseOverlayProps} from 'sentry/utils/useOverlay';

interface Props<OptionType extends OptionTypeBase, MultipleType extends boolean>
  extends Omit<ControlProps<OptionType>, 'choices' | 'multiple' | 'onChange'>,
    UseOverlayProps {
  options: Array<OptionType & {options?: OptionType[]}>;
  /**
   * Pass class name to the outer wrap
   */
  className?: string;
  /**
   * Whether new options are being loaded. When true, CompactSelect will
   * display a loading indicator in the header.
   */
  isLoading?: boolean;
  multiple?: MultipleType;
  onChange?: MultipleType extends true
    ? (values: OptionType[]) => void
    : (value: OptionType) => void;
  onChangeValueMap?: (value: OptionType[]) => ControlProps<OptionType>['value'];
  /**
   * Tag name for the outer wrap, defaults to `div`
   */
  renderWrapAs?: React.ElementType;
  /**
   * Affects the size of the trigger button and menu items.
   */
  size?: FormSize;
  /**
   * Optionally replace the trigger button with a different component. Note
   * that the replacement must have the `props` and `ref` (supplied in
   * TriggerProps) forwarded its outer wrap, otherwise the accessibility
   * features won't work correctly.
   */
  trigger?: (props: Omit<DropdownButtonProps, 'children'>) => React.ReactNode;
  /**
   * By default, the menu trigger will be rendered as a button, with
   * triggerLabel as the button label.
   */
  triggerLabel?: React.ReactNode;
  /**
   * If using the default button trigger (i.e. the custom `trigger` prop has
   * not been provided), then `triggerProps` will be passed on to the button
   * component.
   */
  triggerProps?: DropdownButtonProps;
}

/**
 * Recursively finds the selected option(s) from an options array. Useful for
 * non-flat arrays that contain sections (groups of options).
 */
function getSelectedOptions<
  OptionType extends GeneralSelectValue,
  MultipleType extends boolean
>(
  opts: Props<OptionType, MultipleType>['options'],
  value: Props<OptionType, MultipleType>['value']
): Props<OptionType, MultipleType>['options'] {
  return opts.reduce((acc: Props<OptionType, MultipleType>['options'], cur) => {
    if (cur.options) {
      return acc.concat(getSelectedOptions(cur.options, value));
    }
    if (cur.value === value) {
      return acc.concat(cur);
    }
    return acc;
  }, []);
}

// Exported so we can further customize this component with react-select's
// components prop elsewhere
export const CompactSelectControl = ({
  innerProps,
  ...props
}: React.ComponentProps<typeof selectComponents.Control>) => {
  const {hasValue, selectProps} = props;
  const {isSearchable, menuTitle, isClearable, isLoading} = selectProps;

  return (
    <Fragment>
      {(menuTitle || isClearable || isLoading) && (
        <MenuHeader>
          <MenuTitle>
            <span>{menuTitle}</span>
          </MenuTitle>
          {isLoading && <StyledLoadingIndicator size={12} mini />}
          {hasValue && isClearable && !isLoading && (
            <ClearButton
              type="button"
              size="zero"
              borderless
              onClick={() => props.clearValue()}
              // set tabIndex -1 to autofocus search on open
              tabIndex={isSearchable ? -1 : undefined}
            >
              Clear
            </ClearButton>
          )}
        </MenuHeader>
      )}
      <selectComponents.Control
        {...props}
        innerProps={{...innerProps, ...(!isSearchable && {'aria-hidden': true})}}
      />
    </Fragment>
  );
};

/**
 * A select component with a more compact trigger button. Accepts the same
 * props as SelectControl, plus some more for the trigger button & overlay.
 */
function CompactSelect<
  OptionType extends GeneralSelectValue = GeneralSelectValue,
  MultipleType extends boolean = false
>({
  // Select props
  options,
  onChange,
  defaultValue,
  value: valueProp,
  isDisabled: disabledProp,
  isSearchable = false,
  multiple,
  placeholder = 'Search…',
  onChangeValueMap,
  // Trigger button & wrapper props
  trigger,
  triggerLabel,
  triggerProps,
  isOpen: isOpenProp,
  size = 'md',
  className,
  renderWrapAs,
  closeOnSelect = true,
  menuTitle,
  onClose,
  // Overlay props
  offset = 8,
  position = 'bottom-start',
  shouldCloseOnBlur = true,
  isDismissable = true,
  maxMenuHeight = 400,
  ...props
}: Props<OptionType, MultipleType>) {
  // Manage the dropdown menu's open state
  const isDisabled = disabledProp || options?.length === 0;

  const {
    isOpen,
    state,
    triggerProps: overlayTriggerProps,
    triggerRef,
    overlayProps,
  } = useOverlay({
    isOpen: isOpenProp,
    onClose,
    offset,
    position,
    isDismissable,
    shouldCloseOnBlur,
    shouldCloseOnInteractOutside: target =>
      target && triggerRef.current !== target && !triggerRef.current?.contains(target),
  });

  const {menuTriggerProps} = useMenuTrigger(
    {type: 'listbox', isDisabled},
    {...state, focusStrategy: 'first'},
    triggerRef
  );

  const {buttonProps} = useButton({isDisabled, ...menuTriggerProps}, triggerRef);

  // Keep an internal copy of the current select value and update the control
  // button's label when the value changes
  const [internalValue, setInternalValue] = useState(valueProp ?? defaultValue);

  // Keep track of the default trigger label when the value changes
  const defaultTriggerLabel = useMemo(() => {
    const newValue = valueProp ?? internalValue;
    const valueSet = Array.isArray(newValue) ? newValue : [newValue];
    const selectedOptions = valueSet
      .map(val => getSelectedOptions<OptionType, MultipleType>(options, val))
      .flat();

    return (
      <Fragment>
        <ButtonLabel>{selectedOptions[0]?.label ?? ''}</ButtonLabel>
        {selectedOptions.length > 1 && (
          <StyledBadge text={`+${selectedOptions.length - 1}`} />
        )}
      </Fragment>
    );
  }, [options, valueProp, internalValue]);

  const onValueChange = useCallback(
    option => {
      const valueMap = onChangeValueMap ?? (opts => opts.map(opt => opt.value));
      const newValue = Array.isArray(option) ? valueMap(option) : option?.value;
      setInternalValue(newValue);
      onChange?.(option);

      if (closeOnSelect && !multiple) {
        state.close();
      }
    },
    [state, closeOnSelect, multiple, onChange, onChangeValueMap]
  );

  // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.
  const [triggerWidth, setTriggerWidth] = useState<number>();
  // Update triggerWidth when its size changes using useResizeObserver
  const updateTriggerWidth = useCallback(async () => {
    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));
    const newTriggerWidth = triggerRef.current?.offsetWidth;
    newTriggerWidth && setTriggerWidth(newTriggerWidth);
  }, [triggerRef]);
  useResizeObserver({ref: triggerRef, onResize: updateTriggerWidth});
  // If ResizeObserver is not available, manually update the width
  // when any of [trigger, triggerLabel, triggerProps] changes.
  useEffect(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }
    updateTriggerWidth();
  }, [updateTriggerWidth]);

  function renderTrigger() {
    if (trigger) {
      return trigger({
        size,
        isOpen,
        ...triggerProps,
        ...overlayTriggerProps,
        ...buttonProps,
      });
    }
    return (
      <DropdownButton
        size={size}
        isOpen={isOpen}
        {...triggerProps}
        {...overlayTriggerProps}
        {...buttonProps}
      >
        {triggerLabel ?? defaultTriggerLabel}
      </DropdownButton>
    );
  }

  const theme = useTheme();
  const menuHeight = useMemo(
    () =>
      overlayProps.style?.maxHeight
        ? Math.min(+overlayProps.style?.maxHeight, maxMenuHeight)
        : maxMenuHeight,
    [overlayProps, maxMenuHeight]
  );
  function renderMenu() {
    if (!isOpen) {
      return null;
    }

    return (
      <FocusScope restoreFocus autoFocus>
        <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
          <StyledOverlay minWidth={triggerWidth}>
            <SelectControl
              components={{Control: CompactSelectControl, ClearIndicator: null}}
              {...props}
              options={options}
              value={valueProp ?? internalValue}
              multiple={multiple}
              onChange={onValueChange}
              size={size}
              menuTitle={menuTitle}
              placeholder={placeholder}
              isSearchable={isSearchable}
              menuHeight={menuHeight}
              menuPlacement="bottom"
              menuIsOpen
              isCompact
              controlShouldRenderValue={false}
              hideSelectedOptions={false}
              menuShouldScrollIntoView={false}
              blurInputOnSelect={false}
              closeMenuOnSelect={false}
              closeMenuOnScroll={false}
              openMenuOnFocus
            />
          </StyledOverlay>
        </PositionWrapper>
      </FocusScope>
    );
  }

  return (
    <MenuControlWrap className={className} as={renderWrapAs} role="presentation">
      {renderTrigger()}
      {renderMenu()}
    </MenuControlWrap>
  );
}

export default CompactSelect;

const MenuControlWrap = styled('div')``;

const ButtonLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  top: auto;
`;

const StyledOverlay = styled(Overlay, {
  shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
})<{minWidth?: number}>`
  max-width: calc(100vw - ${space(2)} * 2);
  overflow: hidden;
  ${p => p.minWidth && `min-width: ${p.minWidth}px;`}
`;

const MenuHeader = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.25)} ${space(1)} ${space(0.25)} ${space(1.5)};
  box-shadow: 0 1px 0 ${p => p.theme.translucentInnerBorder};
  z-index: 1;
`;

const MenuTitle = styled('span')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
  margin: ${space(0.5)} ${space(2)} ${space(0.5)} 0;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: ${space(0.5)} ${space(0.5)} ${space(0.5)} ${space(1)};
    height: ${space(1.5)};
    width: ${space(1.5)};
  }
`;

const ClearButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
