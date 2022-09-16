import {useEffect, useRef} from 'react';

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

interface Props extends Omit<CheckboxProps, 'checked'> {
  /**
   * Is the checkbox active? Supports 'indeterminate'
   */
  checked?: CheckboxProps['checked'] | 'indeterminate';
}

const Checkbox = ({checked = false, ...props}: Props) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Support setting the indeterminate value, which is only possible through
  // setting this attribute
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checked === 'indeterminate';
    }
  }, [checked]);

  return (
    <input
      ref={checkboxRef}
      checked={checked !== 'indeterminate' && checked}
      type="checkbox"
      {...props}
    />
  );
};

export default Checkbox;
