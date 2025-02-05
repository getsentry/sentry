import {useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {
  classifyTagKey,
  parseFunction,
  prettifyParsedFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

type Props = {
  fields: string[];
  groupBys: string[];
  mode: Mode;
  yAxes: string[];
};

export function useSortByFields({fields, yAxes, groupBys, mode}: Props) {
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const fieldOptions: Array<SelectOption<string>> = useMemo(() => {
    const uniqueOptions: string[] = [];
    if (mode === Mode.SAMPLES) {
      for (const field of fields) {
        if (!uniqueOptions.includes(field)) {
          uniqueOptions.push(field);
        }
      }
    } else {
      for (const yAxis of yAxes) {
        if (!uniqueOptions.includes(yAxis)) {
          uniqueOptions.push(yAxis);
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
  }, [fields, groupBys, mode, numberTags, stringTags, yAxes]);

  return fieldOptions;
}
