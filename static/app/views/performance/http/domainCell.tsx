import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';

interface Props {
  domain?: string;
  projectId?: string;
}

export function DomainCell({projectId, domain}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  // NOTE: This is for safety only, the product should not fetch or render rows with missing domains or project IDs
  if (!domain) {
    return NULL_DESCRIPTION;
  }

  const project = projects.find(p => projectId === p.id);

  const queryString = {
    ...location.query,
    domain,
  };

  return (
    <DomainDescription>
      {project && <ProjectAvatar project={project} />}

      <OverflowEllipsisTextContainer>
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}/performance/http/domains/?${qs.stringify(queryString)}`
          )}
        >
          {domain}
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

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
