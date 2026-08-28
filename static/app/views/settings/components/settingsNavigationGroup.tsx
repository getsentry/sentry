import {trackAnalytics} from 'sentry/utils/analytics';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {useParams} from 'sentry/utils/useParams';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {SettingsNavItem} from 'sentry/views/settings/components/settingsNavItem';
import type {NavigationGroupProps, NavigationItem} from 'sentry/views/settings/types';

function isItemVisible(item: NavigationItem, props: NavigationGroupProps): boolean {
  if (typeof item.show === 'function') {
    return item.show(props);
  }
  return item.show ?? true;
}

function SettingsNavigationGroupImpl(props: NavigationGroupProps) {
  const {organization, project, name, items} = props;
  const params = useParams();

  const visibleItems = items.filter(item => isItemVisible(item, props));

  // A settings category and the links inside it that are actually visible to
  // this user (post access/feature/hook filtering) — the same list rendered
  // below, not a re-derivation of Sentry's settings nav config.
  useLLMContext({
    contextHint: 'One settings navigation category and its visible items.',
    category: name,
    items: visibleItems.map(item => ({title: item.title, path: item.path})),
  });

  if (!visibleItems.length) {
    return null;
  }

  const navLinks = visibleItems.map(
    ({path, title, index, badge, id, recordAnalytics}) => {
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
    }
  );

  return (
    <SecondaryNavigation.Section id={props.id} title={name}>
      <SecondaryNavigation.List>{navLinks}</SecondaryNavigation.List>
    </SecondaryNavigation.Section>
  );
}

export const SettingsNavigationGroup = registerLLMContext(
  'navigation',
  SettingsNavigationGroupImpl
);
