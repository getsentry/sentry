import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  classifyTagKey,
  parseFunction,
  prettifyParsedFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useExploreMode} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

import {ToolbarHeader, ToolbarLabel, ToolbarRow, ToolbarSection} from './styles';

interface ToolbarSortByProps {
  fields: string[];
  groupBys: string[];
  setSorts: (newSorts: Sort[]) => void;
  sorts: Sort[];
  visualizes: Visualize[];
}

export function ToolbarSortBy({
  fields,
  groupBys,
  setSorts,
  sorts,
  visualizes,
}: ToolbarSortByProps) {
  const mode = useExploreMode();
  const [tab] = useTab();

  // traces table is only sorted by timestamp so disable the sort by
  const disabled = mode === Mode.SAMPLES && tab === Tab.TRACE;

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const fieldOptions: SelectOption<string>[] = useMemo(() => {
    const uniqueOptions: string[] = [];
    if (mode === Mode.SAMPLES) {
      for (const field of fields) {
        if (!uniqueOptions.includes(field)) {
          uniqueOptions.push(field);
        }
      }
    } else {
      for (const visualize of visualizes) {
        for (const yAxis of visualize.yAxes) {
          if (!uniqueOptions.includes(yAxis)) {
            uniqueOptions.push(yAxis);
          }
        }
      }
      for (const groupBy of groupBys) {
        if (!uniqueOptions.includes(groupBy)) {
          uniqueOptions.push(groupBy);
        }
      }
    }

    const options = uniqueOptions.filter(Boolean).map(field => {
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
      return {
        label: prettifyTagKey(field),
        value: field,
        textValue: field,
        trailingItems: <TypeBadge kind={classifyTagKey(field)} />,
      };
    });

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
  }, [fields, groupBys, mode, numberTags, stringTags, visualizes]);

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
