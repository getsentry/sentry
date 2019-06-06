import PropTypes from 'prop-types';
import React from 'react';

import {DEFAULT_RELATIVE_PERIODS, isExtendedStatsPeriod} from 'app/constants';
import SelectorItem from './selectorItem';

const RelativeSelector = ({onClick, selected, hasFeature, relativePeriods}) => {
  return (
    <React.Fragment>
      {Object.entries(relativePeriods || DEFAULT_RELATIVE_PERIODS).map(
        ([value, label]) => (
          <SelectorItem
            key={value}
            onClick={onClick}
            value={value}
            label={label}
            selected={selected === value}
            disabled={!hasFeature && isExtendedStatsPeriod(value)}
          />
        )
      )}
    </React.Fragment>
  );
};

RelativeSelector.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.string,
  hasFeature: PropTypes.bool,
  relativePeriods: PropTypes.object,
};

export default RelativeSelector;
