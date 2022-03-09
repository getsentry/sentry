import * as React from 'react';

import RelativeSelector from 'sentry/components/organizations/timeRangeSelector/dateRange/relativeSelector';
import SelectorItem from 'sentry/components/organizations/timeRangeSelector/dateRange/selectorItem';
import {t} from 'sentry/locale';

type Props = {
  handleAbsoluteClick: (value: string, e?: React.MouseEvent) => void;
  handleSelectRelative: (value: string, e?: React.MouseEvent) => void;
  isAbsoluteSelected: boolean;
  relativeSelected: string;
  relativePeriods?: Record<string, React.ReactNode>;
  shouldShowAbsolute?: boolean;
  // Override DEFAULT_RELATIVE_PERIODS
  shouldShowRelative?: boolean;
};

const SelectorItems = ({
  shouldShowRelative,
  shouldShowAbsolute,
  handleSelectRelative,
  handleAbsoluteClick,
  relativeSelected,
  relativePeriods,
  isAbsoluteSelected,
}: Props) => (
  <React.Fragment>
    {shouldShowRelative && (
      <RelativeSelector
        onClick={handleSelectRelative}
        selected={relativeSelected}
        relativePeriods={relativePeriods}
      />
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
