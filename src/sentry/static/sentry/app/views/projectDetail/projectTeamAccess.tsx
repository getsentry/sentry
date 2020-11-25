import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

type Props = {
  organization: Organization;
  project?: Project | null;
};

type State = {
  collapsed: boolean;
};

class ProjectTeamAccess extends React.Component<Props, State> {
  state: State = {
    collapsed: true,
  };

  static MAX_WHEN_COLLAPSED = 5;

  onCollapseToggle = () => {
    this.setState(prevState => ({
      collapsed: !prevState.collapsed,
    }));
  };

  renderInnerBody() {
    const {project, organization} = this.props;

    if (!project) {
      // TODO(project-detail): check the most common number of teams and set height accordingly
      return <Placeholder />;
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

    const {teams} = project;
    const {collapsed} = this.state;
    const canExpand = teams.length > ProjectTeamAccess.MAX_WHEN_COLLAPSED;
    const teamsToRender =
      collapsed && canExpand
        ? teams.slice(0, ProjectTeamAccess.MAX_WHEN_COLLAPSED)
        : teams;
    const numberOfCollapsedTeams = teams.length - teamsToRender.length;

    return (
      <React.Fragment>
        {teamsToRender.map(team => (
          <StyledLink
            to={`/settings/${organization.slug}/teams/${team.slug}/`}
            key={team.slug}
          >
            <IdBadge team={team} hideAvatar />
          </StyledLink>
        ))}
        {numberOfCollapsedTeams > 0 && (
          <CollapseToggle priority="link" onClick={this.onCollapseToggle}>
            {tn(
              'Show %s collapsed team',
              'Show %s collapsed teams',
              numberOfCollapsedTeams
            )}
          </CollapseToggle>
        )}
        {numberOfCollapsedTeams === 0 && canExpand && (
          <CollapseToggle priority="link" onClick={this.onCollapseToggle}>
            {t('Collapse')}
          </CollapseToggle>
        )}
      </React.Fragment>
    );
  }

  render() {
    return (
      <Section>
        <SectionHeading>{t('Team Access')}</SectionHeading>

        <div>{this.renderInnerBody()}</div>
      </Section>
    );
  }
}

const Section = styled('section')`
  margin-bottom: ${space(2)};
`;

const StyledLink = styled(Link)`
  display: block;
  margin-bottom: ${space(0.5)};
`;

const CollapseToggle = styled(Button)`
  width: 100%;
`;

export default ProjectTeamAccess;
