import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Link from 'app/components/links/link';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {ReleaseProject} from 'app/types';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  projects: ReleaseProject[];
  location: Location;
};

type State = {
  collapsed: boolean;
};

class OtherProjects extends React.Component<Props, State> {
  state = {
    collapsed: true,
  };

  static MAX_WHEN_COLLAPSED = 5;

  onCollapseToggle = () => {
    this.setState(prevState => ({
      collapsed: !prevState.collapsed,
    }));
  };

  render() {
    const {projects, location} = this.props;
    const {collapsed} = this.state;
    const canExpand = projects.length > OtherProjects.MAX_WHEN_COLLAPSED;
    let projectsToRender = projects;

    if (collapsed && canExpand) {
      projectsToRender = projects.slice(0, OtherProjects.MAX_WHEN_COLLAPSED);
    }

    const numberOfCollapsedProjects = projects.length - projectsToRender.length;

    return (
      <Wrapper>
        <SectionHeading>
          {tn(
            'Other Project for This Release',
            'Other Projects for This Release',
            projects.length
          )}
        </SectionHeading>
        {projectsToRender.map(project => (
          <Row key={project.id}>
            <StyledLink
              to={{
                pathname: location.pathname,
                query: {...location.query, project: project.id, yAxis: undefined},
              }}
            >
              <ProjectBadge project={project} avatarSize={16} />
            </StyledLink>
          </Row>
        ))}
        {numberOfCollapsedProjects > 0 && (
          <Button priority="link" onClick={this.onCollapseToggle}>
            {tn(
              'Show %s collapsed project',
              'Show %s collapsed projects',
              numberOfCollapsedProjects
            )}
          </Button>
        )}
        {numberOfCollapsedProjects === 0 && canExpand && (
          <Button priority="link" onClick={this.onCollapseToggle}>
            {t('Collapse')}
          </Button>
        )}
      </Wrapper>
    );
  }
}

const Row = styled('div')`
  margin-bottom: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.blue300};
  ${overflowEllipsis}
`;

const StyledLink = styled(Link)`
  display: inline-block;
`;

export default OtherProjects;
