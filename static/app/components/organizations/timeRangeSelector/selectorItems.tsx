import styled from '@emotion/styled';

import {Item} from 'sentry/components/dropdownAutoComplete/types';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  children: (items: Item[]) => React.ReactElement;
  handleSelectRelative: (value: string) => void;
  relativePeriods?: Record<'string', React.ReactNode>;
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
          label: <Label>{itemLabel}</Label>,
          'data-test-id': value,
        }))
      : []),
    ...(shouldShowAbsolute
      ? [
          {
            index: relativeArr.length,
            value: 'absolute',
            searchKey: 'absolute',
            label: <Label>{t('Absolute date')}</Label>,
            'data-test-id': 'absolute',
          },
        ]
      : []),
  ];

  return children(items);
};

const Label = styled('div')`
  margin-left: ${space(0.5)};
  margin-top: ${space(0.25)};
  margin-bottom: ${space(0.25)};
`;

export default SelectorItems;
