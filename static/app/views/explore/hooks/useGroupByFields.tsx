import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind, prettifyTagKey} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {UNGROUPED} from 'sentry/views/explore/contexts/pageParamsContext/groupBys';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface UseGroupByFieldsProps {
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
  groupBys,
  traceItemType,
  hideEmptyOption,
}: UseGroupByFieldsProps): Array<SelectOption<string>> {
  return useMemo(() => {
    const options = [
      ...Object.entries(numberTags)
        .filter(([key, _]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
        .map(([_, tag]) => optionFromTag(tag, traceItemType)),
      ...Object.entries(stringTags)
        .filter(([key, _]) => !DISALLOWED_GROUP_BY_FIELDS.has(key))
        .map(([_, tag]) => optionFromTag(tag, traceItemType)),
      ...groupBys
        .filter(
          groupBy => groupBy && !(groupBy in numberTags) && !(groupBy in stringTags)
        )
        .map(groupBy =>
          optionFromTag(
            {key: groupBy, name: prettifyTagKey(groupBy), kind: FieldKind.TAG},
            traceItemType
          )
        ),
    ];

    options.sort((a, b) => {
      const aLabel = a.label || '';
      const bLabel = b.label || '';
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
  }, [numberTags, stringTags, groupBys, hideEmptyOption, traceItemType]);
}

function optionFromTag(tag: Tag, traceItemType: TraceItemDataset) {
  return {
    label: tag.name,
    value: tag.key,
    textValue: tag.key,
    trailingItems: <TypeBadge kind={tag.kind} />,
    showDetailsInOverlay: true,
    details: (
      <AttributeDetails
        column={tag.key}
        kind={tag.kind}
        label={tag.key}
        traceItemType={traceItemType}
      />
    ),
  };
}

// Some fields don't make sense to allow users to group by as they create
// very high cardinality groupings and is not useful.
const DISALLOWED_GROUP_BY_FIELDS = new Set(['id', 'timestamp']);

const Disabled = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
