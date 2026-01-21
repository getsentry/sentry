import * as qs from 'query-string';

import {Flex} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {NULL_DOMAIN_DESCRIPTION} from 'sentry/views/insights/http/settings';

interface Props {
  domain?: string;
  projectId?: string;
}

export function DomainCell({projectId, domain}: Props) {
  const moduleURL = useModuleURL('http');
  const location = useLocation();

  const queryString = {
    ...location.query,
    project: projectId,
    'span.domain': undefined,
    domain,
  };

  return (
    <Flex align="center" wrap="nowrap" gap="md">
      <OverflowEllipsisTextContainer>
        <Link to={`${moduleURL}/domains/?${qs.stringify(queryString)}`}>
          {domain && domain.length > 0 ? domain : NULL_DOMAIN_DESCRIPTION}
        </Link>
      </OverflowEllipsisTextContainer>
    </Flex>
  );
}
