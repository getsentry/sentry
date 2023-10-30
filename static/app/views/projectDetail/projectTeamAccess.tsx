import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import Collapsible from 'sentry/components/collapsible';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconOpen} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';

type Props = {
  organization: Organization;
  project?: Project;
};

function ProjectTeamAccess({organization, project}: Props) {
  const hasEditPermissions = organization.access.includes('project:write');
  const settingsLink = `/settings/${organization.slug}/projects/${project?.slug}/teams/`;

  function renderInnerBody() {
    if (!project) {
      return <Placeholder height="23px" />;
    }

    if (project.teams.length === 0) {
      return (
        <Button
          to={settingsLink}
          disabled={!hasEditPermissions}
          title={
            hasEditPermissions ? undefined : t('You do not have permission to do this')
          }
          priority="primary"
          size="sm"
        >
          {t('Assign Team')}
        </Button>
      );
    }

    return (
      <Collapsible
        expandButton={({onExpand, numberOfHiddenItems}) => (
          <Button priority="link" onClick={onExpand}>
            {tn('Show %s collapsed team', 'Show %s collapsed teams', numberOfHiddenItems)}
          </Button>
        )}
      >
        {project.teams
          .sort((a, b) => a.slug.localeCompare(b.slug))
          .map(team => (
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
      <SectionHeadingWrapper>
        <SectionHeading>{t('Team Access')}</SectionHeading>
        <SectionHeadingLink to={settingsLink}>
          <IconOpen />
        </SectionHeadingLink>
      </SectionHeadingWrapper>

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
