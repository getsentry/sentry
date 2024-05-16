import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {type ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: React.ReactNode;
  moduleName: ModuleName;
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
