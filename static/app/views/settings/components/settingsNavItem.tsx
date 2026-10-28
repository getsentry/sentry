import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {NavigationBadge} from 'sentry/views/navigation/secondary/navigationBadge';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

type Props = {
  label: React.ReactNode;
  to: string;
  badge?: string | number | null;
  id?: string;
  index?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

const LabelHook = OverrideOrDefault({
  overrideName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

export function SettingsNavItem({badge, label, id, to, index, ...props}: Props) {
  const settingsV3 = useSettingsV3();
  const badgeElement = badge ? <NavigationBadge badge={badge} /> : null;

  return (
    <SecondaryNavigation.ListItem>
      <Flex
        align="center"
        height={settingsV3 ? '32px' : undefined}
        padding={settingsV3 ? '0 xs 0 md' : undefined}
        gap={settingsV3 ? 'xs' : undefined}
        justify={settingsV3 ? 'start' : undefined}
      >
        {layoutProps => (
          <SecondaryNavigation.Link
            {...layoutProps}
            to={to}
            end={index}
            leading={settingsV3 ? badgeElement : undefined}
            trailingItems={settingsV3 ? null : badgeElement}
            analyticsItemName={id ? `settings_${id}` : undefined}
            {...props}
          >
            <Text density={settingsV3 ? 'fixed' : undefined} variant="inherit">
              <LabelHook id={id}>{label}</LabelHook>
            </Text>
          </SecondaryNavigation.Link>
        )}
      </Flex>
    </SecondaryNavigation.ListItem>
  );
}
