import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';
import type {Direction, Sort} from 'sentry/views/explore/hooks/useSort';

import {ToolbarHeading, ToolbarSection} from './styles';

interface ToolbarSortByProps {
  fields: Field[];
  setSort: (newSort: Sort) => void;
  sort: Sort;
}

export function ToolbarSortBy({fields, setSort, sort}: ToolbarSortByProps) {
  const fieldOptions: SelectOption<Field>[] = useMemo(() => {
    return fields.map(field => {
      return {
        label: field,
        value: field,
      };
    });
  }, [fields]);

  const setSortField = useCallback(
    ({value}: SelectOption<Field>) => {
      setSort({
        field: value,
        direction: sort.direction,
      });
    },
    [setSort, sort]
  );

  const directionOptions: SelectOption<Direction>[] = useMemo(() => {
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

  const setSortDirection = useCallback(
    ({value}: SelectOption<Direction>) => {
      setSort({
        field: sort.field,
        direction: value,
      });
    },
    [setSort, sort]
  );

  return (
    <ToolbarSection data-test-id="section-sort-by">
      <ToolbarHeading>{t('Sort By')}</ToolbarHeading>
      <ToolbarContent>
        <CompactSelect
          size="md"
          options={fieldOptions}
          value={sort.field}
          onChange={setSortField}
        />
        <CompactSelect
          size="md"
          options={directionOptions}
          value={sort.direction}
          onChange={setSortDirection}
        />
      </ToolbarContent>
    </ToolbarSection>
  );
}

const ToolbarContent = styled('div')`
  display: flex;
`;
