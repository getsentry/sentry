import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {buildAttributeOptions} from 'sentry/views/explore/components/attributeOption';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface UseGroupByFieldsProps {
  booleanTags: TagCollection;
  /**
   * All the group bys that are in use. They will be injected if
   * they dont exist already.
   */
  groupBys: readonly string[];
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  hideEmptyOption?: boolean;
}

export function useGroupByFields({
  numberTags,
  stringTags,
  booleanTags,
  groupBys,
  traceItemType,
  hideEmptyOption,
}: UseGroupByFieldsProps): Array<SelectOption<string>> {
  return useMemo(() => {
    const seen = new Set<string>();
    const options = buildAttributeOptions({
      numberTags: filterDisallowed(numberTags),
      stringTags: filterDisallowed(stringTags),
      booleanTags: filterDisallowed(booleanTags),
      traceItemType,
      extraColumns: groupBys.filter(column => !DISALLOWED_GROUP_BY_FIELDS.has(column)),
      extraColumnKind: FieldKind.TAG,
    })
      .filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      })
      .toSorted((a, b) => {
        const aKnown =
          getFieldDefinition(a.value, TRACE_ITEM_FIELD_DEFINITION_TYPE[traceItemType]) !==
          null;
        const bKnown =
          getFieldDefinition(b.value, TRACE_ITEM_FIELD_DEFINITION_TYPE[traceItemType]) !==
          null;
        if (aKnown !== bKnown) return aKnown ? -1 : 1;
        const aLabel = typeof a.label === 'string' ? a.label : (a.textValue ?? '');
        const bLabel = typeof b.label === 'string' ? b.label : (b.textValue ?? '');
        return aLabel.localeCompare(bLabel);
      });

    return [
      // hard code in an empty option
      ...(hideEmptyOption
        ? []
        : [
            {
              label: <Disabled>{t('—')}</Disabled>,
              value: UNGROUPED,
              textValue: t('—'),
            },
          ]),
      ...options,
    ];
  }, [booleanTags, groupBys, hideEmptyOption, numberTags, stringTags, traceItemType]);
}

const TRACE_ITEM_FIELD_DEFINITION_TYPE: Partial<
  Record<TraceItemDataset, 'span' | 'log' | 'tracemetric'>
> = {
  [TraceItemDataset.SPANS]: 'span',
  [TraceItemDataset.LOGS]: 'log',
  [TraceItemDataset.TRACEMETRICS]: 'tracemetric',
};

// Some fields don't make sense to allow users to group by as they create
// very high cardinality groupings and is not useful.
const DISALLOWED_GROUP_BY_FIELDS = new Set(['id', 'timestamp']);

function filterDisallowed(tags: TagCollection): TagCollection {
  return Object.fromEntries(
    Object.entries(tags).filter(([key]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
  );
}

const Disabled = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
