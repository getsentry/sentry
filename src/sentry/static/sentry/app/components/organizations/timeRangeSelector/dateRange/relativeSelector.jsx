import PropTypes from 'prop-types';
import {Fragment} from 'react';

import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';

import SelectorItem from './selectorItem';

const RelativeSelector = ({onClick, selected, relativePeriods}) => (
  <Fragment>
    {Object.entries(relativePeriods || DEFAULT_RELATIVE_PERIODS).map(([value, label]) => (
      <SelectorItem
        key={value}
        onClick={onClick}
        value={value}
        label={label}
        selected={selected === value}
      />
    ))}
  </Fragment>
);

RelativeSelector.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.string,
  relativePeriods: PropTypes.object,
};

export default RelativeSelector;
