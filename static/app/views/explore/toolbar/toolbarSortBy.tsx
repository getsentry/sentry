import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarSortByProps {
  fields: Field[];
  setSorts: (newSorts: Sort[]) => void;
  sorts: Sort[];
}

export function ToolbarSortBy({fields, setSorts, sorts}: ToolbarSortByProps) {
  const fieldOptions: SelectOption<Field>[] = useMemo(() => {
    return fields.map(field => {
      return {
        label: field,
        value: field,
      };
    });
  }, [fields]);

  const setSortField = useCallback(
    (i: number, {value}: SelectOption<Field>) => {
      if (sorts[i]) {
        setSorts([
          {
            field: value,
            kind: sorts[i].kind,
          },
        ]);
      }
    },
    [setSorts, sorts]
  );

  const kindOptions: SelectOption<Sort['kind']>[] = useMemo(() => {
    return [
      {
        label: 'Descending',
        value: 'desc',
      },
      {
        label: 'Ascending',
        value: 'asc',
      },
    ];
  }, []);

  const setSortKind = useCallback(
    (i: number, {value}: SelectOption<Sort['kind']>) => {
      if (sorts[i]) {
        setSorts([
          {
            field: sorts[i].field,
            kind: value,
          },
        ]);
      }
    },
    [setSorts, sorts]
  );

  return (
    <ToolbarSection data-test-id="section-sort-by">
      <ToolbarHeading>{t('Sort By')}</ToolbarHeading>
      <ToolbarContent>
        <CompactSelect
          size="md"
          options={fieldOptions}
          value={sorts[0]?.field}
          onChange={newSortField => setSortField(0, newSortField)}
        />
        <CompactSelect
          size="md"
          options={kindOptions}
          value={sorts[0]?.kind}
          onChange={newSortKind => setSortKind(0, newSortKind)}
        />
      </ToolbarContent>
    </ToolbarSection>
  );
}

const ToolbarContent = styled('div')`
  display: flex;
`;
