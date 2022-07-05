import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import CompactSelect from 'sentry/components/forms/compactSelect';
import Truncate from 'sentry/components/truncate';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';

type BaseProps = React.ComponentProps<typeof CompactSelect> & {
  options: SelectValue<string>[];
  title: string;
  featureType?: 'alpha' | 'beta' | 'new';
};

type SingleProps = BaseProps & {
  onChange: (value: string) => void;
  selected: string;
  multiple?: false;
};
type MultipleProps = BaseProps & {
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
  ...rest
}: SingleProps | MultipleProps) {
  const mappedOptions = useMemo(() => {
    return options.map(opt => ({
      ...opt,
      label: <Truncate value={String(opt.label)} maxLength={60} expandDirection="left" />,
    }));
  }, [options]);

  function onValueChange(option) {
    onChange(multiple ? option.map(o => o.value) : option.value);
  }

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
      options={mappedOptions}
      value={selected}
      onChange={onValueChange}
      isOptionDisabled={isOptionDisabled}
      multiple={multiple}
      triggerProps={{
        size: 'sm',
        borderless: true,
        prefix: (
          <Fragment>
            {title}
            {defined(featureType) ? <StyledFeatureBadge type={featureType} /> : null}
          </Fragment>
        ),
      }}
      placement="bottom right"
      {...rest}
    />
  );
}

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: 0px;
`;

export default OptionSelector;
