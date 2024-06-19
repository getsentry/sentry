import styled from '@emotion/styled';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {NULL_DOMAIN_DESCRIPTION} from 'sentry/views/insights/http/settings';

interface Props {
  domain?: string[];
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
    <DomainDescription>
      <OverflowEllipsisTextContainer>
        <Link to={`${moduleURL}/domains/?${qs.stringify(queryString)}`}>
          {domain && domain.length > 0 ? domain : NULL_DOMAIN_DESCRIPTION}
        </Link>
      </OverflowEllipsisTextContainer>
    </DomainDescription>
  );
}

const DomainDescription = styled('div')`
  display: flex;
  flex-wrap: nowrap;
  gap: ${space(1)};
  align-items: center;
`;
