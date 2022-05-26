import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {FocusScope} from '@react-aria/focus';
import {useMenuTrigger} from '@react-aria/menu';
import {
  AriaPositionProps,
  OverlayProps,
  useOverlay,
  useOverlayPosition,
} from '@react-aria/overlays';
import {mergeProps, useResizeObserver} from '@react-aria/utils';
import {useMenuTriggerState} from '@react-stately/menu';

import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButtonV2';
import SelectControl, {
  ControlProps,
  GeneralSelectValue,
} from 'sentry/components/forms/selectControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import space from 'sentry/styles/space';

interface TriggerRenderingProps {
  props: Omit<DropdownButtonProps, 'children'>;
  ref: React.RefObject<HTMLButtonElement>;
}

interface Props<OptionType>
  extends Omit<ControlProps<OptionType>, 'choices'>,
    Partial<OverlayProps>,
    Partial<AriaPositionProps> {
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
  onChangeValueMap?: (value: OptionType[]) => ControlProps<OptionType>['value'];
  /**
   * Tag name for the outer wrap, defaults to `div`
   */
  renderWrapAs?: React.ElementType;
  /**
   * Optionally replace the trigger button with a different component. Note
   * that the replacement must have the `props` and `ref` (supplied in
   * TriggerProps) forwarded its outer wrap, otherwise the accessibility
   * features won't work correctly.
   */
  trigger?: (props: TriggerRenderingProps) => React.ReactNode;
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
function getSelectedOptions<OptionType extends GeneralSelectValue = GeneralSelectValue>(
  opts: Props<OptionType>['options'],
  value: Props<OptionType>['value']
): Props<OptionType>['options'] {
  return opts.reduce((acc: Props<OptionType>['options'], cur) => {
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
            <ClearButton size="zero" borderless onClick={() => props.clearValue()}>
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
function CompactSelect<OptionType extends GeneralSelectValue = GeneralSelectValue>({
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
  className,
  renderWrapAs,
  // Overlay props
  offset = 8,
  crossOffset = 0,
  containerPadding = 8,
  placement = 'bottom left',
  closeOnSelect = true,
  shouldCloseOnBlur = true,
  isDismissable = true,
  menuTitle,
  ...props
}: Props<OptionType>) {
  // Manage the dropdown menu's open state
  const isDisabled = disabledProp || options?.length === 0;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const state = useMenuTriggerState(props);
  const {menuTriggerProps} = useMenuTrigger(
    {type: 'listbox', isDisabled},
    state,
    triggerRef
  );
  const {buttonProps} = useButton(
    {onPress: () => state.toggle(), isDisabled, ...menuTriggerProps},
    triggerRef
  );

  // Control the overlay's position
  const overlayRef = useRef(null);
  const {overlayProps} = useOverlay(
    {
      onClose: state.close,
      isOpen: state.isOpen,
      shouldCloseOnBlur,
      isDismissable,
      shouldCloseOnInteractOutside: target =>
        target && triggerRef.current !== target && !triggerRef.current?.contains(target),
    },
    overlayRef
  );
  const {overlayProps: positionProps} = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    offset,
    crossOffset,
    placement,
    containerPadding,
    isOpen: state.isOpen,
  });

  // Keep an internal copy of the current select value and update the control
  // button's label when the value changes
  const [internalValue, setInternalValue] = useState(valueProp ?? defaultValue);

  // Update the button label when the value changes
  const getLabel = useCallback((): React.ReactNode => {
    const newValue = valueProp ?? internalValue;
    const valueSet = Array.isArray(newValue) ? newValue : [newValue];
    const selectedOptions = valueSet
      .map(val => getSelectedOptions<OptionType>(options, val))
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

  const [label, setLabel] = useState<React.ReactNode>(null);
  useEffect(() => {
    setLabel(getLabel());
  }, [getLabel]);

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

  function onValueChange(option) {
    const valueMap = onChangeValueMap ?? (opts => opts.map(opt => opt.value));
    const newValue = Array.isArray(option) ? valueMap(option) : option?.value;
    setInternalValue(newValue);
    onChange?.(option);

    if (closeOnSelect && !multiple) {
      state.close();
    }
  }

  function renderTrigger() {
    if (trigger) {
      return trigger({
        props: {
          ...triggerProps,
          ...buttonProps,
          isOpen: state.isOpen,
        },
        ref: triggerRef,
      });
    }
    return (
      <DropdownButton
        ref={triggerRef}
        isOpen={state.isOpen}
        {...triggerProps}
        {...buttonProps}
      >
        {triggerLabel ?? label}
      </DropdownButton>
    );
  }

  function renderMenu() {
    if (!state.isOpen) {
      return null;
    }

    return (
      <FocusScope restoreFocus autoFocus>
        <Overlay
          minWidth={triggerWidth}
          ref={overlayRef}
          {...mergeProps(overlayProps, positionProps)}
        >
          <SelectControl
            components={{Control: CompactSelectControl, ClearIndicator: null}}
            {...props}
            options={options}
            value={valueProp ?? internalValue}
            multiple={multiple}
            onChange={onValueChange}
            menuTitle={menuTitle}
            placeholder={placeholder}
            isSearchable={isSearchable}
            menuPlacement="bottom"
            menuIsOpen
            isCompact
            autoFocus
            controlShouldRenderValue={false}
            hideSelectedOptions={false}
            blurInputOnSelect={false}
            closeMenuOnSelect={false}
            closeMenuOnScroll={false}
          />
        </Overlay>
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
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  top: auto;
`;

const Overlay = styled('div')<{minWidth?: number}>`
  max-width: calc(100% - ${space(2)});
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundElevated};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentBorder}, ${p => p.theme.dropShadowHeavy};
  font-size: ${p => p.theme.fontSizeMedium};
  overflow: hidden;

  /* Override z-index from useOverlayPosition */
  z-index: ${p => p.theme.zIndex.dropdown} !important;

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
  margin-right: ${space(2)};
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
