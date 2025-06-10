import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
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
import {SpanIndexedField} from 'sentry/views/insights/types';

interface UseVisualizeFieldsProps {
  numberTags: TagCollection;
  stringTags: TagCollection;
  parsedFunction?: ParsedFunction | null;
}

export function useVisualizeFields({
  parsedFunction,
  numberTags,
  stringTags,
}: UseVisualizeFieldsProps) {
  const [kind, tags]: [FieldKind, TagCollection] = useMemo(() => {
    if (parsedFunction?.name === AggregationKey.COUNT) {
      const countTags: TagCollection = {
        [SpanIndexedField.SPAN_DURATION]: {
          name: t('spans'),
          key: SpanIndexedField.SPAN_DURATION,
        },
      };
      return [FieldKind.MEASUREMENT, countTags];
    }

    if (NO_ARGUMENT_SPAN_AGGREGATES.includes(parsedFunction?.name as AggregationKey)) {
      const countTags: TagCollection = {
        '': {
          name: t('spans'),
          key: '',
        },
      };
      return [FieldKind.MEASUREMENT, countTags];
    }

    if (parsedFunction?.name === AggregationKey.COUNT_UNIQUE) {
      return [FieldKind.TAG, stringTags];
    }

    return [FieldKind.MEASUREMENT, numberTags];
  }, [parsedFunction?.name, numberTags, stringTags]);

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
          trailingItems: <TypeBadge kind={kind} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails column={option} kind={kind} label={label} type="span" />
          ),
        };
      }),
      ...Object.values(tags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={kind} />,
          showDetailsInOverlay: true,
          details: (
            <AttributeDetails column={tag.key} kind={kind} label={tag.name} type="span" />
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
  }, [kind, tags, unknownField]);

  return fieldOptions;
}
