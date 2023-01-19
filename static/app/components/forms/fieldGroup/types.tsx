/**
 * Props that control UI elements that are part of a Form Group
 */
export interface FieldGroupProps {
  /**
   * Align the control towards the right
   */
  alignRight?: boolean;
  /**
   * The control to render. May be given a function to render with resolved
   * props.
   */
  children?: React.ReactNode | ((props: ChildRenderProps) => React.ReactNode);
  /**
   * The classname of the field
   */
  className?: string;
  /**
   * The classname of the field control
   */
  controlClassName?: string;
  /**
   * Loading / Saving / Error states of the form. See the ControlState
   */
  controlState?: React.ReactNode;
  /**
   * Should field be disabled?
   */
  disabled?: boolean | ((props: FieldGroupProps) => boolean);
  /**
   * Produces a question tooltip on the field, explaining why it is disabled
   */
  disabledReason?: React.ReactNode;
  /**
   * Display the  error indicator
   */
  error?: string | boolean;
  /**
   * Allow the control state to flex based on its content. When enabled the
   * control state element will NOT take up space unless it has some state to
   * show (such as an error).
   */
  flexibleControlStateSize?: boolean;
  /**
   * When false adds padding to the right of the element to ensure visual
   * consistency with other fields that aren't using flexible control states.
   */
  hasControlState?: boolean;
  /**
   * Help or description of the field
   */
  help?: React.ReactNode | ((props: FieldGroupProps) => React.ReactNode);
  /**
   * Hide the fields control state
   */
  hideControlState?: boolean;
  /**
   * Should the label be rendered for the field?
   */
  hideLabel?: boolean;
  /**
   * Is "highlighted", i.e. after a search
   */
  highlighted?: boolean;
  /**
   * The control's `id` property
   */
  id?: string;
  /**
   * Display the field control container in "inline" fashion. The label and
   * description will be aligned to the left, while the control itself will be
   * aligned to the right.
   *
   * @default true
   */
  inline?: boolean;
  /**
   * Display the "was just saved" state
   */
  isSaved?: boolean;
  /**
   * Display the saving state
   */
  isSaving?: boolean;
  /**
   * User-facing field name
   */
  label?: React.ReactNode;
  /**
   * May be used to give the field an aria-label when the field's label is a
   * complex react node.
   */
  labelText?: string;
  /**
   * Show indication that the field is required
   */
  required?: boolean;
  /**
   * Displays the help element in the tooltip
   */
  showHelpInTooltip?: boolean;
  /**
   * When stacking forms the bottom border is hidden and padding is adjusted
   * for form elements to be stacked on each other.
   */
  stacked?: boolean;
  /**
   * Additional inline styles for the field
   */
  style?: React.CSSProperties;
  /**
   * Should field be visible
   */
  visible?: boolean | ((props: FieldGroupProps) => boolean);
}

/**
 * The children render props mostly pass down FieldGroupProps, with some slight
 * differences for properities that were resolved.
 */
interface ChildRenderProps extends Omit<FieldGroupProps, 'className' | 'disabled'> {
  /**
   * Same as {@link FieldGroupProps.controlState}, but will always be defined
   */
  controlState: React.ReactNode;
  /**
   * The rendered help node
   */
  help: React.ReactNode;
  /**
   * Is the field disabled
   */
  disabled?: boolean;
}
