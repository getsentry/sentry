import {Fragment, useMemo} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

export function SortBySection() {
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
          <CompactSelect options={[]} value={undefined} onChange={_newSortField => {}} />
          <CompactSelect
            options={kindOptions}
            value={undefined}
            onChange={_newSortKind => {}}
          />
        </PageFilterBar>
      </Fragment>
    </Section>
  );
}
