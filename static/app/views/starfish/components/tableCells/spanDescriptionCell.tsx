import {Link} from 'react-router';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {ModuleName, StarfishFunctions} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

interface Props {
  moduleName: ModuleName;
  description?: string;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
}

const formatter = new SQLishFormatter();

export function SpanDescriptionCell({
  description,
  group,
  moduleName,
  endpoint,
  endpointMethod,
}: Props) {
  const location = useLocation();

  if (!description) {
    return NULL_DESCRIPTION;
  }

  if (!group) {
    return <OverflowEllipsisTextContainer>{description}</OverflowEllipsisTextContainer>;
  }

  const queryString = {
    ...location.query,
    endpoint,
    endpointMethod,
  };

  const sort: string | undefined = queryString?.[QueryParameterNames.SORT];

  // the spans page uses time_spent_percentage(local), so to persist the sort upon navigation we need to replace
  if (sort?.includes(`${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`)) {
    queryString[QueryParameterNames.SORT] = sort.replace(
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`,
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}(local)`
    );
  }

  return (
    <OverflowEllipsisTextContainer>
      <Link
        to={`/starfish/${extractRoute(location) ?? 'spans'}/span/${group}${
          queryString ? `?${qs.stringify(queryString)}` : ''
        }`}
      >
        {moduleName === ModuleName.DB
          ? formatter.toSimpleMarkup(description)
          : description}
      </Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
