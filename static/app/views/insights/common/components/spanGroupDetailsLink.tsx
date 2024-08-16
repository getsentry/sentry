import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {type ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: React.ReactNode;
  // extra query params to add to the link
  moduleName: ModuleName.DB | ModuleName.RESOURCE;
  projectId: number;
  extraLinkQueryParams?: Record<string, string>;
  group?: string;
  spanOp?: string;
}

export function SpanGroupDetailsLink({
  moduleName,
  group,
  projectId,
  spanOp,
  description,
  extraLinkQueryParams,
}: Props) {
  const location = useLocation();

  const moduleURL = useModuleURL(moduleName);

  const queryString = {
    ...location.query,
    project: projectId,
    ...(spanOp ? {[SPAN_OP]: spanOp} : {}),
    ...(extraLinkQueryParams ? extraLinkQueryParams : {}),
  };

  return (
    <OverflowEllipsisTextContainer>
      {group ? (
        <Link
          to={normalizeUrl(
            `${moduleURL}/spans/span/${group}/?${qs.stringify(queryString)}`
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
