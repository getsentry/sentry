import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import SettingsNavItemDeprecated from 'sentry/views/settings/components/settingsNavItemDeprecated';
import type {NavigationGroupProps} from 'sentry/views/settings/types';

function SettingsNavigationGroupDeprecated(props: NavigationGroupProps) {
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
      if (recordAnalytics && to !== window.location.pathname && organization) {
        trackAnalytics('sidebar.item_clicked', {
          organization,
          project_id: project?.id,
          sidebar_item_id: id,
          dest: path,
        });
      }
    };

    return (
      <SettingsNavItemDeprecated
        key={title}
        to={normalizeUrl(to)}
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
}

const NavSection = styled('div')`
  margin-bottom: 20px;
`;

const SettingsHeading = styled('div')`
  color: ${p => p.theme.text};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: uppercase;
  margin-bottom: ${space(0.5)};
`;

export default SettingsNavigationGroupDeprecated;
