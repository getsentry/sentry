import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {defined} from 'sentry/utils';
import {
  type ParsedFunction,
  parseFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

type Props = {
  yAxes: string[];
};

export function useVisualizeFields({yAxes}: Props) {
  const numberTags = useSpanTags('number');

  const parsedYAxes: ParsedFunction[] = useMemo(() => {
    return yAxes.map(parseFunction).filter(defined);
  }, [yAxes]);

  const fieldOptions: Array<SelectOption<string>> = useMemo(() => {
    const unknownOptions = parsedYAxes
      .flatMap(entry => {
        return entry.arguments;
      })
      .filter(option => {
        return !numberTags.hasOwnProperty(option);
      });

    const options = [
      ...unknownOptions.map(option => ({
        label: prettifyTagKey(option),
        value: option,
        textValue: option,
      })),
      ...Object.values(numberTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
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
  }, [numberTags, parsedYAxes]);

  return fieldOptions;
}
