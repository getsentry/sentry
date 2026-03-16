import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {optionFromTag} from 'sentry/views/explore/components/attributeOption';
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
    const options = [
      ...Object.entries(numberTags)
        .filter(([key, _]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
        .map(([_, tag]) => optionFromTag(tag, traceItemType)),
      ...Object.entries(stringTags)
        .filter(([key, _]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
        .map(([_, tag]) => optionFromTag(tag, traceItemType)),
      ...Object.entries(booleanTags)
        .filter(([key, _]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
        .map(([_, tag]) => optionFromTag(tag, traceItemType)),
      ...groupBys
        .filter(
          groupBy =>
            groupBy &&
            !(groupBy in numberTags) &&
            !(groupBy in stringTags) &&
            !(groupBy in booleanTags)
        )
        .map(groupBy =>
          optionFromTag(
            {key: groupBy, name: prettifyTagKey(groupBy), kind: FieldKind.TAG},
            traceItemType
          )
        ),
    ]
      .filter(option => {
        // Filtering by value here, so it's based off of explicit tags i.e. `key`
        // or `tags[<key>, <boolean | number | string>]
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      })
      .toSorted((a, b) => {
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
              label: <Disabled>{t('\u2014')}</Disabled>,
              value: UNGROUPED,
              textValue: t('\u2014'),
            },
          ]),
      ...options,
    ];
  }, [booleanTags, groupBys, hideEmptyOption, numberTags, stringTags, traceItemType]);
}

// Some fields don't make sense to allow users to group by as they create
// very high cardinality groupings and is not useful.
const DISALLOWED_GROUP_BY_FIELDS = new Set(['id', 'timestamp']);

const Disabled = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
