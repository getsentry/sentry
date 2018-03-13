import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from '../../../proptypes';
import SettingsNavItem from './settingsNavItem';
import replaceRouterParams from '../../../utils/replaceRouterParams';

const NavSection = styled.div`
  margin-bottom: 20px;
`;

const SettingsHeading = styled.div`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 20px;
`;

export default class NavigationGroup extends React.Component {
  static propTypes = {
    ...SentryTypes.NavigationGroup,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    access: PropTypes.object,
    features: PropTypes.object,
  };

  static contextTypes = {
    router: PropTypes.object,
    location: PropTypes.object,
  };

  render() {
    let {organization, project, name, items} = this.props;
    let {router} = this.context;

    return (
      <NavSection>
        <SettingsHeading>{name}</SettingsHeading>
        {items.map(({path, title, show, badge}) => {
          if (typeof show === 'function' && !show(this.props)) return null;
          if (typeof show !== 'undefined' && !show) return null;
          let badgeResult = typeof badge === 'function' ? badge(this.props) : null;
          let to = replaceRouterParams(path, {
            orgId: organization && organization.slug,
            projectId: project && project.slug,
          });

          return (
            <SettingsNavItem
              active={router.isActive(to)}
              key={title}
              to={to}
              label={title}
              badge={badgeResult}
            />
          );
        })}
      </NavSection>
    );
  }
}
