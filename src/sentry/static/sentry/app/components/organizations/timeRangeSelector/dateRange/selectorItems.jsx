import PropTypes from 'prop-types';
import {Fragment} from 'react';

import {t} from 'app/locale';
import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';

const SelectorItems = ({
  shouldShowRelative,
  shouldShowAbsolute,
  handleSelectRelative,
  handleAbsoluteClick,
  relativeSelected,
  isAbsoluteSelected,
}) => (
  <Fragment>
    {shouldShowRelative && (
      <RelativeSelector onClick={handleSelectRelative} selected={relativeSelected} />
    )}
    {shouldShowAbsolute && (
      <SelectorItem
        onClick={handleAbsoluteClick}
        value="absolute"
        label={t('Absolute date')}
        selected={isAbsoluteSelected}
        last
      />
    )}
  </Fragment>
);

SelectorItems.propTypes = {
  shouldShowRelative: PropTypes.bool,
  shouldShowAbsolute: PropTypes.bool,
  handleSelectRelative: PropTypes.func,
  handleAbsoluteClick: PropTypes.func,
  relativeSelected: PropTypes.string,
  isAbsoluteSelected: PropTypes.bool,
};

export default SelectorItems;
