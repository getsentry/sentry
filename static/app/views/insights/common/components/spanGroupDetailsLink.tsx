import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {SpanMetricsField} from 'sentry/views/insights/spanFields';
import type {ModuleName} from 'sentry/views/insights/types';

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: React.ReactNode;
  moduleName: ModuleName.DB | ModuleName.RESOURCE;
  projectId: number;
  group?: string;
  spanOp?: string;
}

export function SpanGroupDetailsLink({
  moduleName,
  group,
  projectId,
  spanOp,
  description,
}: Props) {
  const location = useLocation();

  const moduleURL = useModuleURL(moduleName);

  const queryString = {
    ...location.query,
    project: projectId,
    ...(spanOp ? {[SPAN_OP]: spanOp} : {}),
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
