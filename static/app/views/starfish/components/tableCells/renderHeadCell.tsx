import {Location} from 'history';

import {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {
  aggregateFunctionOutputType,
  fieldAlignment,
  parseFunction,
  Sort,
} from 'sentry/utils/discover/fields';
import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Options = {
  column: GridColumnHeader<string>;
  isAggregate?: boolean;
  location?: Location;
  sort?: Sort;
};

const {SPAN_SELF_TIME} = SpanMetricsFields;
const {TIME_SPENT_PERCENTAGE, SPS, SPM, HTTP_ERROR_COUNT} = StarfishFunctions;

export const SORTABLE_FIELDS = new Set([
  `avg(${SPAN_SELF_TIME})`,
  `p95(${SPAN_SELF_TIME})`,
  `${SPS}()`,
  `${SPM}()`,
  `${TIME_SPENT_PERCENTAGE}()`,
  `${TIME_SPENT_PERCENTAGE}(local)`,
  `${HTTP_ERROR_COUNT}()`,
]);

export const renderHeadCell = ({
  column,
  location,
  sort,
  isAggregate = false,
}: Options) => {
  const {key, name} = column;
  const alignment = getAlignment(key);

  const newSortDirection: Sort['kind'] =
    sort?.field === column.key && sort.kind === 'desc' ? 'asc' : 'desc';

  const newSort = `${newSortDirection === 'desc' ? '-' : ''}${key}`;

  const tooltipContent = getFieldDescription(key, isAggregate);
  const title = tooltipContent ? (
    <Tooltip key={key} isHoverable title={tooltipContent} showUnderline>
      <div>{name}</div>
    </Tooltip>
  ) : (
    name
  );

  return (
    <SortLink
      align={alignment}
      canSort={Boolean(location && sort && SORTABLE_FIELDS.has(key))}
      direction={sort?.field === column.key ? sort.kind : undefined}
      title={title}
      generateSortLink={() => {
        return {
          ...location,
          query: {
            ...location?.query,
            [QueryParameterNames.SORT]: newSort,
          },
        };
      }}
    />
  );
};

export const getAlignment = (key: string): Alignments => {
  const result = parseFunction(key);
  if (result) {
    const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);
    if (outputType) {
      return fieldAlignment(key, outputType);
    }
  }
  return 'left';
};

function getFieldDescription(key: string, isAggregate: boolean): string | undefined {
  if (isAggregate) {
    switch (key) {
      case `${SPM}()`:
        return t('The number of queries per minute across all endpoints.');
      case `avg(${SPAN_SELF_TIME})`:
        return t('The average duration of this query across all endpoints.');
      default:
    }
  }

  switch (key) {
    case `${SPM}()`:
      return t('The number of queries per minute in this endpoint.');
    case `avg(${SPAN_SELF_TIME})`:
      return t('The average duration of this query in this endpoint.');
    default:
      return undefined;
  }
}
