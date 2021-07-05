import * as React from 'react';

import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';

import SelectorItem from './selectorItem';

type Props = {
  onClick: (value: string, e?: React.MouseEvent) => void;
  selected: string;
  relativePeriods?: Record<string, React.ReactNode>;
};

const RelativeSelector = ({onClick, selected, relativePeriods}: Props) => (
  <React.Fragment>
    {Object.entries(relativePeriods || DEFAULT_RELATIVE_PERIODS).map(([value, label]) => (
      <SelectorItem
        key={value}
        onClick={onClick}
        value={value}
        label={label}
        selected={selected === value}
      />
    ))}
  </React.Fragment>
);

export default RelativeSelector;
