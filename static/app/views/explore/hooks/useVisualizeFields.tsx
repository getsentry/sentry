import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {defined} from 'sentry/utils';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {parseFunction, prettifyTagKey} from 'sentry/utils/discover/fields';
import {AggregationKey, FieldKind} from 'sentry/utils/fields';
import {AttributeDetails} from 'sentry/views/explore/components/attributeDetails';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

interface Props {
  /**
   * All the aggregates that are in use. The arguments will be extracted
   * and injected as options if they are compatible.
   */
  yAxes: string[];
  /**
   * The current aggregate in use. Used to determine what the argument
   * types will be compatible.
   */
  yAxis?: string;
}

export function useVisualizeFields({yAxis, yAxes}: Props) {
  const {tags: stringTags} = useSpanTags('string');
  const {tags: numberTags} = useSpanTags('number');

  const parsedYAxis = useMemo(() => (yAxis ? parseFunction(yAxis) : undefined), [yAxis]);

  const tags =
    parsedYAxis?.name === AggregationKey.COUNT_UNIQUE ? stringTags : numberTags;

  const parsedYAxes: ParsedFunction[] = useMemo(() => {
    return yAxes.map(parseFunction).filter(defined);
  }, [yAxes]);

  const fieldOptions: Array<SelectOption<string>> = useMemo(() => {
    const kind =
      parsedYAxis?.name === AggregationKey.COUNT_UNIQUE
        ? FieldKind.TAG
        : FieldKind.MEASUREMENT;

    const unknownOptions = parsedYAxes
      .flatMap(entry => {
        return entry.arguments;
      })
      .filter(option => {
        return !tags.hasOwnProperty(option);
      });

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
  }, [tags, parsedYAxes, parsedYAxis?.name]);

  return fieldOptions;
}
