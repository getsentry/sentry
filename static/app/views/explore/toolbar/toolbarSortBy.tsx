import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {formatParsedFunction, parseFunction} from 'sentry/utils/discover/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';

import {ToolbarHeader, ToolbarLabel, ToolbarRow, ToolbarSection} from './styles';

interface ToolbarSortByProps {
  fields: Field[];
  setSorts: (newSorts: Sort[]) => void;
  sorts: Sort[];
}

export function ToolbarSortBy({fields, setSorts, sorts}: ToolbarSortByProps) {
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const fieldOptions: SelectOption<Field>[] = useMemo(() => {
    return fields.map(field => {
      const tag = stringTags[field] ?? numberTags[field] ?? null;
      if (tag) {
        return {
          label: tag.name,
          value: field,
          textValue: tag.name,
          trailingItems: <TypeBadge tag={tag} />,
        };
      }

      const func = parseFunction(field);
      if (func) {
        const formatted = formatParsedFunction(func);
        return {
          label: formatted,
          value: field,
          textValue: formatted,
          trailingItems: <TypeBadge func={func} />,
        };
      }

      // not a tag, maybe it's an aggregate
      return {
        label: field,
        value: field,
        textValue: field,
        trailingItems: <TypeBadge tag={tag} />,
      };
    });
  }, [fields, numberTags, stringTags]);

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
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t('Results you see first and last in your samples or aggregates.')}
        >
          <ToolbarLabel>{t('Sort By')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      <div>
        <ToolbarRow>
          <CompactSelect
            options={fieldOptions}
            value={sorts[0]?.field}
            onChange={newSortField => setSortField(0, newSortField)}
          />
          <CompactSelect
            options={kindOptions}
            value={sorts[0]?.kind}
            onChange={newSortKind => setSortKind(0, newSortKind)}
          />
        </ToolbarRow>
      </div>
    </ToolbarSection>
  );
}
