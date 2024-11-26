import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  parseFunction,
  prettifyParsedFunction,
  prettifyTagKey,
  TYPED_TAG_KEY_RE,
} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

import {ToolbarHeader, ToolbarLabel, ToolbarRow, ToolbarSection} from './styles';

interface ToolbarSortByProps {
  fields: Field[];
  setSorts: (newSorts: Sort[]) => void;
  sorts: Sort[];
}

export function ToolbarSortBy({fields, setSorts, sorts}: ToolbarSortByProps) {
  const [resultMode] = useResultMode();
  const [tab] = useTab();

  // traces table is only sorted by timestamp so disable the sort by
  const disabled = resultMode === 'samples' && tab === Tab.TRACE;

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const fieldOptions: SelectOption<Field>[] = useMemo(() => {
    const options = [
      ...new Set(fields).keys().map(field => {
        const tag = stringTags[field] ?? numberTags[field] ?? null;
        if (tag) {
          return {
            label: tag.name,
            value: field,
            textValue: tag.name,
            trailingItems: <TypeBadge kind={tag?.kind} />,
          };
        }

        const func = parseFunction(field);
        if (func) {
          const formatted = prettifyParsedFunction(func);
          return {
            label: formatted,
            value: field,
            textValue: formatted,
            trailingItems: <TypeBadge func={func} />,
          };
        }

        const result = field.match(TYPED_TAG_KEY_RE);
        const kind =
          result?.[2] === 'string'
            ? FieldKind.TAG
            : result?.[2] === 'number'
              ? FieldKind.MEASUREMENT
              : undefined;

        return {
          label: prettifyTagKey(field),
          value: field,
          textValue: field,
          trailingItems: <TypeBadge kind={kind} />,
        };
      }),
    ];

    options.sort((a, b) => {
      if (a.label < b.label) {
        return -1;
      }

      if (a.label > b.label) {
        return 1;
      }

      return 0;
    });

    return options;
  }, [fields, numberTags, stringTags]);

  const setSortField = useCallback(
    (i: number, {value}: SelectOption<SelectKey>) => {
      if (sorts[i] && typeof value === 'string') {
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
    (i: number, {value}: SelectOption<SelectKey>) => {
      if (sorts[i]) {
        setSorts([
          {
            field: sorts[i].field,
            kind: value as Sort['kind'],
          },
        ]);
      }
    },
    [setSorts, sorts]
  );

  let toolbarRow = (
    <ToolbarRow>
      <ColumnCompactSelect
        options={fieldOptions}
        value={sorts[0]?.field}
        onChange={newSortField => setSortField(0, newSortField)}
        disabled={disabled}
      />
      <DirectionCompactSelect
        options={kindOptions}
        value={sorts[0]?.kind}
        onChange={newSortKind => setSortKind(0, newSortKind)}
        disabled={disabled}
      />
    </ToolbarRow>
  );

  if (disabled) {
    toolbarRow = (
      <FullWidthTooltip
        position="top"
        title={t('Sort by is not applicable to trace results.')}
      >
        {toolbarRow}
      </FullWidthTooltip>
    );
  }

  return (
    <ToolbarSection data-test-id="section-sort-by">
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t('Results you see first and last in your samples or aggregates.')}
        >
          <ToolbarLabel disabled={disabled}>{t('Sort By')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      <div>{toolbarRow}</div>
    </ToolbarSection>
  );
}

const FullWidthTooltip = styled(Tooltip)`
  width: 100%;
`;

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const DirectionCompactSelect = styled(CompactSelect)`
  width: 90px;

  > button {
    width: 100%;
  }
`;
