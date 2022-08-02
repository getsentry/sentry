import {forwardRef} from 'react';

type OnChangeHandler = (
  value: boolean,
  event: React.ChangeEvent<HTMLInputElement>
) => void;

type OptionProps = {
  label: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  onBlur?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChange?: OnChangeHandler;
};

const Option = forwardRef(function Option(
  {name, disabled, label, value, checked, onChange, onBlur}: OptionProps,
  ref: React.Ref<HTMLInputElement>
) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const isTrue = e.target.value === 'true';

    onChange?.(isTrue, e);
    // Manually trigger blur to trigger saving on change
    onBlur?.(e);
  }

  return (
    <div className="radio">
      <label style={{fontWeight: 'normal'}}>
        <input
          ref={ref}
          type="radio"
          value={value}
          name={name}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />{' '}
        {label}
      </label>
    </div>
  );
});

type Props = {
  disabled?: boolean;
  name?: string;
  noLabel?: string;
  onBlur?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChange?: OnChangeHandler;
  value?: boolean;
  yesFirst?: boolean;
  yesLabel?: string;
};

const RadioBoolean = forwardRef(function RadioBoolean(
  {
    disabled,
    name,
    onChange,
    onBlur,
    value,
    yesFirst = true,
    yesLabel = 'Yes',
    noLabel = 'No',
  }: Props,
  ref: React.Ref<HTMLInputElement>
) {
  const yesOption = (
    <Option
      ref={ref}
      value="true"
      checked={value === true}
      name={name}
      disabled={disabled}
      label={yesLabel}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
  const noOption = (
    <Option
      value="false"
      checked={value === false}
      name={name}
      disabled={disabled}
      label={noLabel}
      onChange={onChange}
      onBlur={onBlur}
    />
  );

  return (
    <div>
      {yesFirst ? yesOption : noOption}
      {yesFirst ? noOption : yesOption}
    </div>
  );
});

export default RadioBoolean;
