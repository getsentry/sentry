import {useMemo} from 'react';

import type {SelectOption} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {Tag, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  FieldKind,
  NO_ARGUMENT_SPAN_AGGREGATES,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';

interface UseVisualizeFieldsProps {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  parsedFunction?: ParsedFunction | null;
}

export function useVisualizeFields({
  booleanTags,
  parsedFunction,
  numberTags,
  stringTags,
  traceItemType,
}: UseVisualizeFieldsProps) {
  const tags: TagCollection = useMemo(() => {
    return getSupportedAttributes({
      functionName: parsedFunction?.name || '',
      numberTags,
      stringTags,
      booleanTags,
      traceItemType,
    });
  }, [booleanTags, numberTags, parsedFunction?.name, stringTags, traceItemType]);

  const unknownField = parsedFunction?.arguments[0];

  const fieldOptions: Array<SelectOption<string>> = useMemo(() => {
    const seen = new Set<string>();
    const unknownOptions = [unknownField]
      .filter(defined)
      .filter(option => !tags.hasOwnProperty(option));

    return [
      ...unknownOptions.map(option => {
        const label = prettifyTagKey(option);
        return optionFromTag({key: option, name: label}, traceItemType);
      }),
      ...Object.values(tags).map(tag => {
        return optionFromTag(tag, traceItemType);
      }),
    ]
      .filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      })
      .toSorted((a, b) => {
        const aLabel = a.label || '';
        const bLabel = b.label || '';
        return aLabel.localeCompare(bLabel);
      });
  }, [tags, unknownField, traceItemType]);

  return fieldOptions;
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

function getSupportedAttributes({
  functionName,
  numberTags,
  booleanTags,
  stringTags,
  traceItemType,
}: {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  traceItemType: TraceItemDataset;
  functionName?: string;
}): TagCollection {
  if (traceItemType === TraceItemDataset.SPANS) {
    if (functionName === AggregationKey.COUNT) {
      const countTags: TagCollection = {
        [SpanFields.SPAN_DURATION]: {
          name: t('spans'),
          key: SpanFields.SPAN_DURATION,
          kind: FieldKind.MEASUREMENT,
        },
      };
      return countTags;
    }

    if (NO_ARGUMENT_SPAN_AGGREGATES.includes(functionName as AggregationKey)) {
      return {
        '': {
          name: t('spans'),
          key: '',
        },
      };
    }

    if (functionName === AggregationKey.COUNT_UNIQUE) {
      return {...numberTags, ...stringTags, ...booleanTags};
    }

    return numberTags;
  }

  throw new Error('Cannot get support attributes for unknown trace item type');
}
