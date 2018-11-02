import PropTypes from 'prop-types';
import React from 'react';

import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import SelectorItem from './selectorItem';

const RelativeSelector = ({onClick, selected}) => {
  return (
    <React.Fragment>
      {Object.entries(DEFAULT_RELATIVE_PERIODS).map(([value, label]) => (
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
};

RelativeSelector.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.string,
};

export default RelativeSelector;
