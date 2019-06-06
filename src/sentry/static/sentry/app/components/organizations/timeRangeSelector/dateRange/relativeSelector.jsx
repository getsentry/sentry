import PropTypes from 'prop-types';
import React from 'react';

import {DEFAULT_RELATIVE_PERIODS, isExtendedStatsPeriod} from 'app/constants';
import Feature from 'app/components/acl/feature';
import SentryTypes from 'app/sentryTypes';
import SelectorItem from './selectorItem';

const RelativeSelector = ({onClick, selected, organization}) => {
  return (
    <Feature
      features={['organizations:extended-data-retention']}
      organization={organization}
    >
      {({hasFeature}) =>
        Object.entries(DEFAULT_RELATIVE_PERIODS).map(([value, label]) => (
          <SelectorItem
            key={value}
            onClick={onClick}
            value={value}
            label={label}
            selected={selected === value}
            disabled={!hasFeature && isExtendedStatsPeriod(value)}
          />
        ))
      }
    </Feature>
  );
};

RelativeSelector.propTypes = {
  onClick: PropTypes.func,
  selected: PropTypes.string,
  organization: SentryTypes.Organization,
};

export default RelativeSelector;
