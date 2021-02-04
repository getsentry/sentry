import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import Collapsible from 'app/components/collapsible';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

import {SidebarSection} from './styles';

type Props = {
  organization: Organization;
  project?: Project | null;
};

function ProjectTeamAccess({organization, project}: Props) {
  function renderInnerBody() {
    if (!project) {
      return <Placeholder height="23px" />;
    }

    if (project.teams.length === 0) {
      const hasPermission = organization.access.includes('project:write');
      return (
        <Button
          to={`/settings/${organization.slug}/projects/${project.slug}/teams/`}
          disabled={!hasPermission}
          title={hasPermission ? undefined : t('You do not have permission to do this')}
          priority="primary"
          size="small"
        >
          {t('Assign Team')}
        </Button>
      );
    }

    return (
      <Collapsible
        expandButton={({onExpand, numberOfCollapsedItems}) => (
          <Button priority="link" onClick={onExpand}>
            {tn(
              'Show %s collapsed team',
              'Show %s collapsed teams',
              numberOfCollapsedItems
            )}
          </Button>
        )}
      >
        {project.teams.map(team => (
          <StyledLink
            to={`/settings/${organization.slug}/teams/${team.slug}/`}
            key={team.slug}
          >
            <IdBadge team={team} hideAvatar />
          </StyledLink>
        ))}
      </Collapsible>
    );
  }

  return (
    <StyledSidebarSection>
      <SectionHeading>{t('Team Access')}</SectionHeading>

      <div>{renderInnerBody()}</div>
    </StyledSidebarSection>
  );
}

const StyledSidebarSection = styled(SidebarSection)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledLink = styled(Link)`
  display: block;
  margin-bottom: ${space(0.5)};
`;

export default ProjectTeamAccess;
