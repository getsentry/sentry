import {Item} from 'sentry/components/dropdownAutoComplete/types';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

import TimeRangeItemLabel from './timeRangeItemLabel';

type Props = {
  children: (items: Item[]) => React.ReactElement;
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

  const items: Item[] = [
    ...(shouldShowRelative
      ? relativeArr.map(([value, itemLabel], index) => ({
          index,
          value,
          searchKey: typeof itemLabel === 'string' ? itemLabel : value,
          label: <TimeRangeItemLabel>{itemLabel}</TimeRangeItemLabel>,
          'data-test-id': value,
        }))
      : []),
    ...(shouldShowAbsolute
      ? [
          {
            index: relativeArr.length,
            value: 'absolute',
            searchKey: 'absolute',
            label: <TimeRangeItemLabel>{t('Absolute date')}</TimeRangeItemLabel>,
            'data-test-id': 'absolute',
          },
        ]
      : []),
  ];

  return children(items);
};

export default SelectorItems;
