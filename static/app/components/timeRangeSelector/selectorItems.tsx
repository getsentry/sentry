import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

import TimeRangeItemLabel from './timeRangeItemLabel';
import type {TimeRangeItem} from './types';

type Props = {
  children: (items: TimeRangeItem[]) => React.ReactElement;
  handleSelectRelative: (value: string) => void;
  relativePeriods?: Record<string, React.ReactNode>;
  shouldShowAbsolute?: boolean;
  shouldShowRelative?: boolean;
};

const SelectorItems = ({
  children,
  relativePeriods,
  shouldShowRelative,
  shouldShowAbsolute,
}: Props) => {
  const relativeArr = Object.entries(relativePeriods ?? DEFAULT_RELATIVE_PERIODS);

  const items: TimeRangeItem[] = [
    ...(shouldShowRelative
      ? relativeArr.map(([value, itemLabel]) => ({
          value,
          textValue: typeof itemLabel === 'string' ? itemLabel : value,
          label: <TimeRangeItemLabel>{itemLabel}</TimeRangeItemLabel>,
        }))
      : []),
    ...(shouldShowAbsolute
      ? [
          {
            value: 'absolute',
            textValue: 'absolute',
            label: <TimeRangeItemLabel>{t('Absolute date')}</TimeRangeItemLabel>,
          },
        ]
      : []),
  ];

  return children(items);
};

export default SelectorItems;
