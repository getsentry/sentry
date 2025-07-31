import {trackAnalytics} from 'sentry/utils/analytics';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {useParams} from 'sentry/utils/useParams';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import SettingsNavItem from 'sentry/views/settings/components/settingsNavItem';
import type {NavigationGroupProps} from 'sentry/views/settings/types';

function SettingsNavigationGroup(props: NavigationGroupProps) {
  const {organization, project, name, items} = props;
  const params = useParams();

  const navLinks = items.map(({path, title, index, show, badge, id, recordAnalytics}) => {
    if (typeof show === 'function' && !show(props)) {
      return null;
    }
    if (typeof show !== 'undefined' && !show) {
      return null;
    }
    const badgeResult = typeof badge === 'function' ? badge(props) : null;
    const to = replaceRouterParams(path, {...params, orgId: organization?.slug});

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
    <SecondaryNav.Section id={props.id} title={name}>
      {navLinks}
    </SecondaryNav.Section>
  );
}

export default SettingsNavigationGroup;
