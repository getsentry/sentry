import React from 'react';

import RelativeSelector from 'app/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'app/components/organizations/timeRangeSelector/dateRange/selectorItem';
import {t} from 'app/locale';

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

export default SelectorItems;
