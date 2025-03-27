import {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {SpanIndexedField} from 'sentry/views/insights/types';

type Props = {
  serviceEntrySpanName: string;
};

const LIMIT = 10;

// TODO: When the span buffer is finalized, we will be able to expand this list and allow breakdowns on more categories.
// for now, it will only allow categories that match the hardcoded list of span ops that were supported in the previous iteration
const ALLOWED_CATEGORIES = ['http', 'db', 'browser', 'resource', 'ui'];

export function SpanCategoryFilter({serviceEntrySpanName}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const {selection} = usePageFilters();
  const location = useLocation();
  const navigate = useNavigate();

  const query = new MutableSearch('');
  query.addFilterValue('transaction', serviceEntrySpanName);

  const {data, isError} = useEAPSpans(
    {
      limit: LIMIT,
      fields: [SpanIndexedField.SPAN_CATEGORY, 'count()'],
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      pageFilters: selection,
    },
    'api.transaction-summary.span-category-filter'
  );

  const {options: categoryOptions} = useCompactSelectOptionsCache(
    data
      .filter(d => !!d[SpanIndexedField.SPAN_CATEGORY])
      .filter(d => ALLOWED_CATEGORIES.includes(d[SpanIndexedField.SPAN_CATEGORY]))
      .map(d => ({
        value: d[SpanIndexedField.SPAN_CATEGORY],
        label: d[SpanIndexedField.SPAN_CATEGORY],
        key: d[SpanIndexedField.SPAN_CATEGORY],
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
    setSelectedCategory(selectedOption?.value ?? undefined);

    navigate({
      ...location,
      query: {
        ...location.query,
        [SpanIndexedField.SPAN_CATEGORY]: selectedOption?.value,
      },
    });
  };

  return (
    <CompactSelect
      clearable
      disallowEmptySelection={false}
      menuTitle={t('Filter by category')}
      onClear={() => setSelectedCategory(undefined)}
      options={categoryOptions}
      value={selectedCategory ?? undefined}
      onChange={onChange}
      triggerLabel={selectedCategory ? selectedCategory : t('Filter')}
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
