import {Fragment, useEffect, useRef, useState} from 'react';
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
import {mergeProps} from '@react-aria/utils';
import {useMenuTriggerState} from '@react-stately/menu';

import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButtonV2';
import SelectControl, {ControlProps} from 'sentry/components/forms/selectControl';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

type TriggerProps = {
  props: Omit<React.HTMLAttributes<Element>, 'children'> & {
    onClick?: (e: MouseEvent) => void;
  };
  ref: React.RefObject<HTMLButtonElement>;
};

type Props = ControlProps &
  Partial<OverlayProps> &
  Partial<AriaPositionProps> & {
    /**
     * Pass class name to the outer wrap
     */
    className?: string;
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
    trigger?: (props: TriggerProps) => React.ReactNode;
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
  };

// Exported so we can further customize this component with react-select's
// components prop elsewhere
export const CompactSelectControl = ({
  innerProps,
  ...props
}: React.ComponentProps<typeof selectComponents.Control>) => {
  const {hasValue, selectProps} = props;
  const {isSearchable, menuTitle, isClearable} = selectProps;

  return (
    <Fragment>
      {(menuTitle || isClearable) && (
        <MenuHeader>
          <MenuTitle>{menuTitle}</MenuTitle>
          {hasValue && isClearable && (
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
function CompactSelect({
  // Select props
  options,
  onChange,
  defaultValue,
  value: valueProp,
  isDisabled: disabledProp,
  isSearchable = false,
  multiple,
  placeholder = 'Search…',
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
}: Props) {
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
  const [label, setLabel] = useState(getLabel(valueProp ?? null));

  // Update the button label when the value changes
  function getLabel(newValue): React.ReactNode {
    const valueSet = Array.isArray(newValue) ? newValue : [newValue];
    const optionSet = valueSet.map(val => options.find(opt => opt.value === val));
    const firstOptionLabel = optionSet[0] ? optionSet[0]?.label : '';

    return (
      <Fragment>
        <ButtonLabel>{firstOptionLabel}</ButtonLabel>
        {optionSet.length > 1 && <StyledBadge text={`+${optionSet.length - 1}`} />}
      </Fragment>
    );
  }

  useEffect(() => {
    const newValue = valueProp ?? internalValue;
    const newLabel = getLabel(newValue);
    setLabel(newLabel);
  }, [valueProp ?? internalValue]);

  // Calculate & update the trigger button's width, to be used as the
  // overlay's min-width
  const [triggerWidth, setTriggerWidth] = useState<number>();
  useEffect(() => {
    // Wait until the trigger label has been updated before calculating the
    // new width
    setTimeout(() => {
      const newTriggerWidth = triggerRef.current?.offsetWidth;
      newTriggerWidth ?? setTriggerWidth(newTriggerWidth);
    }, 0);
  }, [triggerRef.current, internalValue]);

  function onValueChange(option) {
    const newValue = Array.isArray(option) ? option.map(opt => opt.value) : option?.value;
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
            {...props}
            options={options}
            value={valueProp ?? internalValue}
            multiple={multiple}
            onChange={onValueChange}
            menuTitle={menuTitle}
            placeholder={placeholder}
            isSearchable={isSearchable}
            components={{Control: CompactSelectControl, ClearIndicator: null}}
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
  ${overflowEllipsis}
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
  display: flex;
  justify-content: space-between;
  padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(1.5)};
  border-bottom: solid 1px ${p => p.theme.innerBorder};
`;

const MenuTitle = styled('span')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
  margin-right: ${space(1)};
`;

const ClearButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
