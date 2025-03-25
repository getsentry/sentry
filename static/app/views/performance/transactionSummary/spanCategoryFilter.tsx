import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  serviceEntrySpanName: string;
};

const LIMIT = 10;

export function SpanCategoryFilter({serviceEntrySpanName}: Props) {
  const [category, setCategory] = useState<string | undefined>(undefined);

  const searchQuery = useMemo(() => {
    const query = new MutableSearch('');
    query.addFilterValue('transaction', serviceEntrySpanName);
    return query;
  }, [serviceEntrySpanName]);

  const {data, isError} = useEAPSpans(
    {
      limit: LIMIT,
      fields: [SpanIndexedField.SPAN_CATEGORY, 'count()'],
      search: searchQuery,
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.transaction-summary.span-category-filter'
  );

  const {options: categoryOptions} = useCompactSelectOptionsCache(
    data
      .filter(d => !!d[SpanIndexedField.SPAN_CATEGORY])
      .map(d => ({
        value: d[SpanIndexedField.SPAN_CATEGORY],
        label: d[SpanIndexedField.SPAN_CATEGORY],
        leadingItems: (
          <OperationDot
            backgroundColor={pickBarColor(d[SpanIndexedField.SPAN_CATEGORY])}
          />
        ),
      }))
  );

  if (isError) {
    return (
      <Tooltip title={t('Error loading span categories')}>
        <CompactSelect disabled options={[]} />
      </Tooltip>
    );
  }

  const onChange = (selectedOption: SelectOption<string> | null) => {
    setCategory(selectedOption?.value ?? undefined);
  };

  return (
    <CompactSelect
      clearable
      disallowEmptySelection={false}
      menuTitle={t('Filter by category')}
      onClear={() => setCategory(undefined)}
      options={categoryOptions}
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
