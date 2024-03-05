import {Link} from 'react-router';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';

interface Props {
  domain?: string;
}

export function DomainCell({domain}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  // NOTE: This is for safety only, the product should not fetch or render rows with missing domains or project IDs
  if (!domain) {
    return NULL_DESCRIPTION;
  }

  const queryString = {
    ...location.query,
    domain,
  };

  return (
    <OverflowEllipsisTextContainer>
      <Link
        to={normalizeUrl(
          `/organizations/${organization.slug}/performance/http/domains/?${qs.stringify(queryString)}`
        )}
      >
        {domain}
      </Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
