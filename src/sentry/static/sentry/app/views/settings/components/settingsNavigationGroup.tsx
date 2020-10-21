import styled from '@emotion/styled';

import SettingsNavItem from 'app/views/settings/components/settingsNavItem';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import {NavigationGroupProps} from 'app/views/settings/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';

const SettingsNavigationGroup = (props: NavigationGroupProps) => {
  const {organization, project, name, items} = props;

  return (
    <NavSection data-test-id={name}>
      <SettingsHeading>{name}</SettingsHeading>
      {items.map(({path, title, index, show, badge, id, recordAnalytics}) => {
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

        const handleClick = () => {
          //only call the analytics event if the URL is changing
          if (recordAnalytics && to !== window.location.pathname) {
            trackAnalyticsEvent({
              organization_id: organization && organization.id,
              project_id: project && project.id,
              eventName: 'Sidebar Item Clicked',
              eventKey: 'sidebar.item_clicked',
              sidebar_item_id: id,
              dest: path,
            });
          }
        };

        return (
          <SettingsNavItem
            key={title}
            to={to}
            label={title}
            index={index}
            badge={badgeResult}
            id={id}
            onClick={handleClick}
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
  color: ${p => p.theme.gray600};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 20px;
`;

export default SettingsNavigationGroup;
