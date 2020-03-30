import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import IdBadge from 'app/components/idBadge';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import ProjectSelector from 'app/components/projectSelector';
import space from 'app/styles/space';

const ProjectHeaderProjectSelector = withRouter(
  class ProjectHeaderProjectSelector extends React.Component {
    static propTypes = {
      organization: PropTypes.object.isRequired,
      router: PropTypes.object,
    };

    static contextTypes = {
      location: PropTypes.object,
    };

    /**
     * Returns an object with the target project url. If
     * the router is present, passed as the 'to' property.
     * If not, passed as an absolute URL via the 'href' property.
     */
    getProjectUrlProps(project) {
      const org = this.props.organization;
      const path = `/${org.slug}/${project.slug}/`;

      if (this.context.location) {
        return {to: path};
      } else {
        return {href: path};
      }
    }

    getProjectLabel(project) {
      return project.slug;
    }

    handleSelect = project => {
      const {router} = this.props;
      const {to, href} = this.getProjectUrlProps(project);
      if (to) {
        router.push(to);
      } else {
        window.location.assign(href);
      }
    };

    renderDropDownLabelContent = (getActorProps, activeProject) => {
      if (activeProject) {
        const {to, href} = this.getProjectUrlProps(activeProject);
        return (
          <IdBadge
            project={activeProject}
            avatarSize={20}
            displayName={
              <ProjectNameLink to={to || href}>
                {this.getProjectLabel(activeProject)}
              </ProjectNameLink>
            }
          />
        );
      }

      return (
        <SelectProject
          {...getActorProps({
            role: 'button',
          })}
        >
          {t('Select a project')}
        </SelectProject>
      );
    };

    render() {
      return (
        <ProjectSelector {...this.props} onSelect={this.handleSelect}>
          {({getActorProps, activeProject}) => (
            <DropdownLabel>
              {this.renderDropDownLabelContent(getActorProps, activeProject)}
              <DropdownIcon />
            </DropdownLabel>
          )}
        </ProjectSelector>
      );
    }
  }
);

export default ProjectHeaderProjectSelector;

const FlexY = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DropdownLabel = styled(FlexY)`
  margin-right: ${space(1)};
`;

const DropdownIcon = styled(props => <InlineSvg {...props} src="icon-chevron-down" />)`
  margin-left: ${space(0.5)};
  font-size: 10px;
`;

const SelectProject = styled('span')`
  color: ${p => p.theme.gray4};
  cursor: pointer;
  font-size: 20px;
  font-weight: 600;
  padding-right: ${space(0.5)};
`;

const ProjectNameLink = styled(Link)`
  color: ${p => p.theme.textColor};
  font-size: 20px;
  line-height: 1.2;
  font-weight: 600;
  margin-left: ${space(0.25)};
`;
