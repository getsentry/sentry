import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  search: string;
  serviceEntrySpanName: string;
};

const LIMIT = 10;

export function SpanCategoryFilter({search, serviceEntrySpanName}: Props) {
  const [category, setCategory] = useState<string | undefined>(undefined);

  const searchQuery = useMemo(() => {
    const query = new MutableSearch(search);
    query.addFilterValue('transaction', serviceEntrySpanName);

    if (category) {
      query.addFilterValue('span.category', category);
    }
    return query;
  }, [search, serviceEntrySpanName, category]);

  const {data, isPending, error} = useEAPSpans(
    {
      limit: LIMIT,
      fields: [SpanIndexedField.SPAN_CATEGORY, 'count()'],
      search: searchQuery,
      sorts: [{field: 'count()', kind: 'desc'}],
      enabled: !!category,
    },
    'api.transaction-summary.span-category-filter'
  );

  const options = useMemo(() => {
    if (isPending || error) {
      return [];
    }

    return data
      .filter(d => !!d[SpanIndexedField.SPAN_CATEGORY])
      .map(d => ({
        label: d[SpanIndexedField.SPAN_CATEGORY],
        value: d[SpanIndexedField.SPAN_CATEGORY],
        leadingItems: (
          <OperationDot
            backgroundColor={pickBarColor(d[SpanIndexedField.SPAN_CATEGORY])}
          />
        ),
      }));
  }, [data, isPending, error]);

  const onChange = (selectedOption: SelectOption<string> | null) => {
    console.log('selectedOption', selectedOption);
    setCategory(selectedOption?.value ?? undefined);
  };

  return (
    <CompactSelect
      clearable
      // disallowEmptySelection={false}
      menuTitle={t('Filter by category')}
      onClear={() => setCategory(undefined)}
      options={options}
      value={category ?? undefined}
      onChange={onChange}
      triggerLabel={t('Filter')}
      triggerProps={{icon: <IconFilter />, 'aria-label': t('Filter by category')}}
    />
  );
}

const OperationDot = styled('div')<{backgroundColor: string}>`
  display: block;
  width: ${space(1)};
  height: ${space(1)};
  border-radius: 100%;
  background-color: ${p => p.backgroundColor};
`;
