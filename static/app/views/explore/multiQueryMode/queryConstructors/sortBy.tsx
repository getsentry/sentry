import {Fragment, useMemo} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function SortBySection({query, index}: Props) {
  const mode = query.groupBys.length === 0 ? Mode.SAMPLES : Mode.AGGREGATE;
  const fields = query.fields;
  const groupBys = query.groupBys;
  const yAxes = query.yAxes;

  const fieldOptions = useSortByFields({fields, yAxes, groupBys, mode});
  const updateSort = useUpdateQueryAtIndex();

  const kindOptions: Array<SelectOption<Sort['kind']>> = useMemo(() => {
    return [
      {
        label: 'Desc',
        value: 'desc',
        textValue: t('Descending'),
      },
      {
        label: 'Asc',
        value: 'asc',
        textValue: t('Ascending'),
      },
    ];
  }, []);

  return (
    <Section data-test-id="section-sort-by">
      <SectionHeader>
        <Tooltip
          position="right"
          title={t('Results you see first and last in your samples or aggregates.')}
        >
          <SectionLabel>{t('Sort By')}</SectionLabel>
        </Tooltip>
      </SectionHeader>
      <Fragment>
        <PageFilterBar>
          <CompactSelect
            options={fieldOptions}
            value={query.sortBys?.[0]?.field}
            onChange={newSortField => {
              const newSorts = query.sortBys?.map(sort => {
                return {...sort, field: newSortField.value};
              });
              updateSort(index, {sortBys: newSorts});
            }}
          />
          <CompactSelect
            options={kindOptions}
            value={query.sortBys?.[0]?.kind}
            onChange={newSortKind => {
              const newSorts = query.sortBys?.map(sort => {
                return {...sort, kind: newSortKind.value};
              });
              updateSort(index, {sortBys: newSorts});
            }}
          />
        </PageFilterBar>
      </Fragment>
    </Section>
  );
}
