import * as React from 'react';

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
  onChange?: OnChangeHandler;
};

const Option = React.forwardRef(function Option(
  {name, disabled, label, value, checked, onChange}: OptionProps,
  ref: React.Ref<HTMLInputElement>
) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const isTrue = e.target.value === 'true';

    onChange?.(isTrue, e);
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
  onChange?: OnChangeHandler;
  value?: boolean;
  yesFirst?: boolean;
  yesLabel?: string;
};

const RadioBoolean = React.forwardRef(function RadioBoolean(
  {
    disabled,
    name,
    onChange,
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
