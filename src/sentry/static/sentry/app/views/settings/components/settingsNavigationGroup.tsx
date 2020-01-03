import React from 'react';
import styled from 'react-emotion';

import SettingsNavItem from 'app/views/settings/components/settingsNavItem';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import {NavigationGroupProps} from 'app/views/settings/types';

const SettingsNavigationGroup = (props: NavigationGroupProps) => {
  const {organization, project, name, items} = props;

  return (
    <NavSection data-test-id={name}>
      <SettingsHeading>{name}</SettingsHeading>
      {items.map(({path, title, index, show, badge, id}) => {
        if (typeof show === 'function' && !show(props)) {
          return null;
        }
        if (typeof show !== 'undefined' && !show) {
          return null;
        }
        const badgeResult = typeof badge === 'function' ? badge(props) : null;
        const to = replaceRouterParams(path, {
          ...(organization ? {orgId: organization.slug} : {}),
          ...(project ? {projectId: project.slug} : {}),
        });

        return (
          <SettingsNavItem
            key={title}
            to={to}
            label={title}
            index={index}
            badge={badgeResult}
            id={id}
          />
        );
      })}
    </NavSection>
  );
};

const NavSection = styled('div')`
  margin-bottom: 20px;
`;

const SettingsHeading = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 20px;
`;

export default SettingsNavigationGroup;
