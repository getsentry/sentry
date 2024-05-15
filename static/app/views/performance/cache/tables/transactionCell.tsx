import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useCacheModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {ModuleName} from 'sentry/views/starfish/types';

interface Props {
  project?: string;
  transaction?: string;
  transactionMethod?: string;
}

export function TransactionCell({project, transaction}: Props) {
  const moduleURL = useCacheModuleURL();
  const organization = useOrganization();
  const location = useLocation();

  if (!transaction) {
    return NULL_DESCRIPTION;
  }

  const query = {
    ...location.query,
    transaction,
    project,
  };

  return (
    <OverflowEllipsisTextContainer>
      <Link
        onClick={() =>
          trackAnalytics('performance_views.sample_spans.opened', {
            organization,
            source: ModuleName.CACHE,
          })
        }
        to={`${moduleURL}/?${qs.stringify(query)}`}
      >
        {transaction}
      </Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
