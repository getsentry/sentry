import {Link} from 'react-router';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {SpanFunction} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

interface Props {
  description: React.ReactNode;
  projectId: number;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
}

export function SpanDescriptionLink({
  group,
  projectId,
  endpoint,
  endpointMethod,
  description,
}: Props) {
  const location = useLocation();
  const routingContext = useRoutingContext();

  const queryString = {
    ...location.query,
    project: projectId,
    endpoint,
    endpointMethod,
  };

  const sort: string | undefined = queryString[QueryParameterNames.SPANS_SORT];

  // the spans page uses time_spent_percentage(local), so to persist the sort upon navigation we need to replace
  if (sort?.includes(`${SpanFunction.TIME_SPENT_PERCENTAGE}()`)) {
    queryString[QueryParameterNames.SPANS_SORT] = sort.replace(
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
      `${SpanFunction.TIME_SPENT_PERCENTAGE}(local)`
    );
  }

  return (
    <OverflowEllipsisTextContainer>
      {group ? (
        <Link
          to={`${routingContext.baseURL}/${
            extractRoute(location) ?? 'spans'
          }/span/${group}?${qs.stringify(queryString)}`}
        >
          {description}
        </Link>
      ) : (
        description
      )}
    </OverflowEllipsisTextContainer>
  );
}
