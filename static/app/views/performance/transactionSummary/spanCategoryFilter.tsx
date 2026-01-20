import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {SpanFields} from 'sentry/views/insights/types';

type Props = {
  serviceEntrySpanName: string;
};

const LIMIT = 10;

// TODO: When the span buffer is finalized, we will be able to expand this list and allow breakdowns on more categories.
// for now, it will only allow categories that match the hardcoded list of span ops that were supported in the previous iteration
const ALLOWED_CATEGORIES = ['http', 'db', 'browser', 'resource', 'ui'];

export function SpanCategoryFilter({serviceEntrySpanName}: Props) {
  const location = useLocation();
  const spanCategoryUrlParam = decodeScalar(location.query?.[SpanFields.SPAN_CATEGORY]);

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    spanCategoryUrlParam
  );

  const {selection} = usePageFilters();
  const navigate = useNavigate();
  const theme = useTheme();

  const query = new MutableSearch('');
  query.addFilterValue('transaction', serviceEntrySpanName);

  const {data, isError} = useSpans(
    {
      limit: LIMIT,
      fields: [SpanFields.SPAN_CATEGORY, 'count()'],
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      pageFilters: selection,
    },
    'api.transaction-summary.span-category-filter'
  );

  const {options: categoryOptions} = useCompactSelectOptionsCache(
    data
      .filter(d => !!d[SpanFields.SPAN_CATEGORY])
      .filter(d => ALLOWED_CATEGORIES.includes(d[SpanFields.SPAN_CATEGORY]))
      .map(d => ({
        value: d[SpanFields.SPAN_CATEGORY],
        label: d[SpanFields.SPAN_CATEGORY],
        key: d[SpanFields.SPAN_CATEGORY],
        leadingItems: (
          <OperationDot
            backgroundColor={pickBarColor(d[SpanFields.SPAN_CATEGORY], theme)}
          />
        ),
      }))
  );

  const onChange = (selectedOption: SelectOption<string> | undefined) => {
    setSelectedCategory(selectedOption?.value);

    navigate({
      ...location,
      query: {
        ...location.query,
        [SpanFields.SPAN_CATEGORY]: selectedOption?.value,
      },
    });
  };

  if (isError) {
    return (
      <Tooltip title={t('Error loading span categories')}>
        <CompactSelect disabled options={[]} value={undefined} onChange={onChange} />
      </Tooltip>
    );
  }

  return (
    <CompactSelect
      clearable
      menuTitle={t('Filter by category')}
      options={categoryOptions}
      value={selectedCategory ?? undefined}
      onChange={onChange}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          icon={<IconFilter />}
          aria-label={t('Filter by category')}
        >
          {selectedCategory ? selectedCategory : t('Filter')}
        </OverlayTrigger.Button>
      )}
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
