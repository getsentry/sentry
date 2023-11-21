import {Link} from 'react-router';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';

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
