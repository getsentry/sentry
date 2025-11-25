import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {FeatureBadge} from 'sentry/components/core/badge';
import type {
  MultipleSelectProps,
  SelectOption,
  SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOptionWithKey} from 'sentry/components/core/compactSelect/types';
import Truncate from 'sentry/components/truncate';
import {defined} from 'sentry/utils';

type BaseProps = {
  title: string;
  featureType?: 'alpha' | 'beta' | 'new';
};

type SingleUnClearableProps = DistributedOmit<
  SingleSelectProps<string>,
  'onChange' | 'multiple' | 'title' | 'value'
> &
  BaseProps & {
    onChange: (value: string) => void;
    selected: string;
    clearable?: false;
    multiple?: false;
  };

type SingleClearableProps = DistributedOmit<
  SingleSelectProps<string>,
  'onChange' | 'multiple' | 'title' | 'value'
> &
  BaseProps & {
    clearable: true;
    onChange: (value: string | undefined) => void;
    selected: string;
    multiple?: false;
  };

type SingleProps = SingleClearableProps | SingleUnClearableProps;

type MultipleProps = DistributedOmit<
  MultipleSelectProps<string>,
  'onChange' | 'multiple' | 'title' | 'value'
> &
  BaseProps & {
    multiple: true;
    onChange: (value: string[]) => void;
    selected: string[];
  };

function OptionSelector({
  options,
  onChange,
  selected,
  title,
  featureType,
  multiple,
  closeOnSelect,
  clearable,
  ...rest
}: SingleProps | MultipleProps) {
  const mappedOptions = useMemo(() => {
    return options.map(opt => ({
      ...opt,
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      textValue: String(opt.label),
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      label: <Truncate value={String(opt.label)} maxLength={60} expandDirection="left" />,
    }));
  }, [options]);

  const selectProps = useMemo(() => {
    // Use an if statement to help TS separate MultipleProps and SingleProps
    if (multiple) {
      return {
        multiple,
        clearable,
        value: selected,
        onChange: (sel: Array<SelectOption<string>>) => {
          onChange?.(sel.map(o => o.value));
        },
        closeOnSelect,
      };
    }

    if (clearable) {
      return {
        multiple,
        clearable,
        value: selected,
        onChange: (opt: SelectOption<string> | undefined) => onChange?.(opt?.value),
        closeOnSelect,
      };
    }

    return {
      multiple,
      clearable,
      value: selected,
      onChange: (opt: SelectOption<string>) => onChange?.(opt.value),
      closeOnSelect,
    };
  }, [clearable, multiple, selected, onChange, closeOnSelect]);

  function isOptionDisabled(option: SelectOptionWithKey<string>) {
    return Boolean(
      // Option is explicitly marked as disabled
      // The user has reached the maximum number of selections (3), and the option hasn't
      // yet been selected. These options should be disabled to visually indicate that the
      // user has reached the max.
      option.disabled ||
        (multiple && selected.length === 3 && !selected.includes(option.value))
    );
  }

  return (
    <CompactSelect
      {...rest}
      {...selectProps}
      size="sm"
      options={mappedOptions}
      isOptionDisabled={isOptionDisabled}
      position="bottom-end"
      triggerProps={{
        borderless: true,
        prefix: (
          <Fragment>
            {title}
            {defined(featureType) ? <StyledFeatureBadge type={featureType} /> : null}
          </Fragment>
        ),
      }}
    />
  );
}

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: 0px;
`;

export default OptionSelector;
