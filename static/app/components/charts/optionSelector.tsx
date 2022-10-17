import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import FeatureBadge from 'sentry/components/featureBadge';
import Truncate from 'sentry/components/truncate';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';

type BaseProps = React.ComponentProps<typeof CompactSelect> & {
  options: SelectValue<string>[];
  title: string;
  featureType?: 'alpha' | 'beta' | 'new';
};

interface SingleProps extends Omit<BaseProps, 'onChange'> {
  onChange: (value: string) => void;
  selected: string;
}
interface MultipleProps extends Omit<BaseProps, 'onChange'> {
  onChange: (value: string[]) => void;
  selected: string[];
}

function OptionSelector<MultipleType extends boolean>({
  options,
  onChange,
  selected,
  title,
  featureType,
  multiple,
  ...rest
}: MultipleType extends true ? MultipleProps : SingleProps) {
  const mappedOptions = useMemo(() => {
    return options.map(opt => ({
      ...opt,
      label: <Truncate value={String(opt.label)} maxLength={60} expandDirection="left" />,
    }));
  }, [options]);

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
      size="sm"
      options={mappedOptions}
      value={selected}
      onChange={option => {
        onChange(multiple ? option.map(o => o.value) : option.value);
      }}
      isOptionDisabled={isOptionDisabled}
      multiple={multiple}
      triggerProps={{
        borderless: true,
        prefix: (
          <Fragment>
            {title}
            {defined(featureType) ? <StyledFeatureBadge type={featureType} /> : null}
          </Fragment>
        ),
      }}
      position="bottom-end"
      {...rest}
    />
  );
}

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: 0px;
`;

export default OptionSelector;
