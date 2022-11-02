import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import SettingsNavItem from 'sentry/views/settings/components/settingsNavItem';
import {NavigationGroupProps} from 'sentry/views/settings/types';

const SettingsNavigationGroup = (props: NavigationGroupProps) => {
  const {organization, project, name, items} = props;

  const navLinks = items.map(({path, title, index, show, badge, id, recordAnalytics}) => {
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
      // only call the analytics event if the URL is changing
      if (recordAnalytics && to !== window.location.pathname) {
        trackAnalyticsEvent({
          organization_id: organization ? organization.id : null,
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
  });

  if (!navLinks.some(link => link !== null)) {
    return null;
  }

  return (
    <NavSection data-test-id={name}>
      <SettingsHeading role="heading">{name}</SettingsHeading>
      {navLinks}
    </NavSection>
  );
};

const NavSection = styled('div')`
  margin-bottom: 20px;
`;

const SettingsHeading = styled('div')`
  color: ${p => p.theme.text};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

export default SettingsNavigationGroup;
