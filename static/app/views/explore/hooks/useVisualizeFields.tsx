import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {defined} from 'sentry/utils';
import {
  type ParsedFunction,
  parseFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
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
    const unknownOptions = parsedYAxes
      .flatMap(entry => {
        return entry.arguments;
      })
      .filter(option => {
        return !tags.hasOwnProperty(option);
      });

    const options = [
      ...unknownOptions.map(option => ({
        label: prettifyTagKey(option),
        value: option,
        textValue: option,
      })),
      ...Object.values(tags).map(tag => {
        return {label: tag.name, value: tag.key, textValue: tag.name};
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
  }, [tags, parsedYAxes]);

  return fieldOptions;
}
