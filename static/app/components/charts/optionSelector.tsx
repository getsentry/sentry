import {Fragment} from 'react';
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
  const mappedOptions = options.map(opt => ({
    ...opt,
    label: <Truncate value={String(opt.label)} maxLength={60} expandDirection="left" />,
  }));

  function onValueChange(option) {
    if (multiple && option.length > 3) {
      return;
    }
    onChange(multiple ? option.map(o => o.value) : option.value);
  }

  return (
    <CompactSelect
      options={mappedOptions}
      value={selected}
      onChange={onValueChange}
      isOptionDisabled={opt => opt.disabled}
      multiple={multiple}
      triggerProps={{
        size: 'small',
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
