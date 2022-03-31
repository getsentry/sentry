type SliderProps = {
  name: string;

  /**
   * String is a valid type here only for empty string
   * Otherwise react complains:
   * "`value` prop on `input` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components."
   *
   * And we want this to be a controlled input when value is empty
   */
  value: number | '';

  /**
   * Array of allowed values. Make sure `value` is in this list.
   * THIS NEEDS TO BE SORTED
   */
  allowedValues?: number[];

  className?: string;

  disabled?: boolean;
  /**
   * Render prop for slider's label
   * Is passed the value as an argument
   */
  formatLabel?: (value: number | '') => React.ReactNode;

  forwardRef?: React.Ref<HTMLDivElement>;

  /**
   * max allowed value, not needed if using `allowedValues`
   */
  max?: number;

  /**
   * min allowed value, not needed if using `allowedValues`
   */
  min?: number;
  /**
   * This is called when *any* MouseUp or KeyUp event happens.
   * Used for "smart" Fields to trigger a "blur" event. `onChange` can
   * be triggered quite frequently
   */
  onBlur?: (
    event: React.MouseEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>
  ) => void;

  onChange?: (
    value: SliderProps['value'],
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;

  /**
   * Placeholder for custom input
   */
  placeholder?: string;
  /**
   * Show input control for custom values
   */
  showCustomInput?: boolean;
  /**
   * Show label with current value
   */
  showLabel?: boolean;
  step?: number;
};

export default SliderProps;
