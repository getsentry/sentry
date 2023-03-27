import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {
  CompactSelect,
  MultipleSelectProps,
  SelectOption,
  SingleSelectProps,
} from 'sentry/components/compactSelect';
import FeatureBadge from 'sentry/components/featureBadge';
import Truncate from 'sentry/components/truncate';
import {defined} from 'sentry/utils';

type BaseProps = {
  title: string;
  featureType?: 'alpha' | 'beta' | 'new';
};

interface SingleProps
  extends Omit<SingleSelectProps<string>, 'onChange' | 'defaultValue' | 'multiple'>,
    BaseProps {
  onChange: (value: string) => void;
  selected: string;
  defaultValue?: string;
  multiple?: false;
}

interface MultipleProps
  extends Omit<MultipleSelectProps<string>, 'onChange' | 'defaultValue' | 'multiple'>,
    BaseProps {
  multiple: true;
  onChange: (value: string[]) => void;
  selected: string[];
  defaultValue?: string[];
}

function OptionSelector({
  options,
  onChange,
  selected,
  title,
  featureType,
  multiple,
  defaultValue,
  ...rest
}: SingleProps | MultipleProps) {
  const mappedOptions = useMemo(() => {
    return options.map(opt => ({
      ...opt,
      textValue: String(opt.label),
      label: <Truncate value={String(opt.label)} maxLength={60} expandDirection="left" />,
    }));
  }, [options]);

  const selectProps = useMemo(() => {
    // Use an if statement to help TS separate MultipleProps and SingleProps
    if (multiple) {
      return {
        multiple,
        value: selected,
        defaultValue,
        onChange: (sel: SelectOption<string>[]) => {
          onChange?.(sel.map(o => o.value));
        },
      };
    }

    return {
      multiple,
      value: selected,
      defaultValue,
      onChange: opt => onChange?.(opt.value),
    };
  }, [multiple, selected, defaultValue, onChange]);

  function isOptionDisabled(option) {
    return (
      // Option is explicitly marked as disabled
      option.disabled ||
      // The user has reached the maximum number of selections (3), and the option hasn't
      // yet been selected. These options should be disabled to visually indicate that the
      // user has reached the max.
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
