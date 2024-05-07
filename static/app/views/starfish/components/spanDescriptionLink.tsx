import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: React.ReactNode;
  projectId: number;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
  spanOp?: string;
}

export function SpanDescriptionLink({
  group,
  projectId,
  endpoint,
  endpointMethod,
  spanOp,
  description,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const routingContext = useRoutingContext();

  const queryString = {
    ...location.query,
    project: projectId,
    endpoint,
    endpointMethod,
    ...(spanOp ? {[SPAN_OP]: spanOp} : {}),
  };

  return (
    <OverflowEllipsisTextContainer>
      {group ? (
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}${routingContext.baseURL}/${
              extractRoute(location) ?? 'spans'
            }/span/${group}/?${qs.stringify(queryString)}`
          )}
        >
          {description}
        </Link>
      ) : (
        description
      )}
    </OverflowEllipsisTextContainer>
  );
}
