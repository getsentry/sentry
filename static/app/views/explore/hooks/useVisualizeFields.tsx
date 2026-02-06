import {useMemo} from 'react';

import type {SelectOption} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
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
    const unknownOptions = [unknownField]
      .filter(defined)
      .filter(option => !tags.hasOwnProperty(option));

    const options = [
      ...unknownOptions.map(option => {
        const label = prettifyTagKey(option);
        return {
          label,
          value: option,
          textValue: option,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={option}
              label={label}
              traceItemType={traceItemType}
            />
          ),
        };
      }),
      ...Object.values(tags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={tag.kind} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails
              column={tag.key}
              kind={tag.kind}
              label={tag.name}
              traceItemType={traceItemType}
            />
          ),
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
  }, [tags, unknownField, traceItemType]);

  return fieldOptions;
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
