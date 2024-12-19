import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import { Mode } from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useExploreUrl} from 'sentry/views/explore/utils';

export function OpenInExploreButton({query}: {query: MutableSearch}) {
  const organization = useOrganization();
  const

  const queryObj = {
    query: query.formatString(),
    groupBy: 'span.description' satisfies EAPSpanProperty,
    visualize: {
      chartType: 1,
      yAxes: ['avg(span.duration)', 'count(span.duration)'] satisfies EAPSpanProperty[],
    },
    mode: 'aggregate',
  };

  const url = useExploreUrl({
    query: query.formatString(),
    interval: '5m',
    visualize: [
      {
        chartType: 1,
        yAxes: ['avg(span.duration)', 'count(span.duration)'],
      },
    ],
    mode: Mode.AGGREGATE,
    field: ['avg(span.duration)', 'count(span.duration)'],
  });
}
