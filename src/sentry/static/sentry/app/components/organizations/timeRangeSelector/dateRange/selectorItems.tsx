import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';

type Props = {
  handleSelectRelative: (value: string, e: React.MouseEvent) => void;
  handleAbsoluteClick: (value: string, e: React.MouseEvent) => void;
  isAbsoluteSelected: boolean;
  relativeSelected: string;
  shouldShowRelative?: boolean;
  shouldShowAbsolute?: boolean;
};

const SelectorItems = ({
  shouldShowRelative,
  shouldShowAbsolute,
  handleSelectRelative,
  handleAbsoluteClick,
  relativeSelected,
  isAbsoluteSelected,
}: Props) => (
  <React.Fragment>
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
  </React.Fragment>
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
