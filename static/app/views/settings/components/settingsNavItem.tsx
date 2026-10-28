import {Fragment, type ReactElement} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Badge, FeatureBadge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {t} from 'sentry/locale';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

type Props = {
  label: React.ReactNode;
  to: string;
  badge?: string | number | null | ReactElement;
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
  const badgeElement = badge ? <SettingsNavBadge badge={badge} /> : null;

  return (
    <SecondaryNavigation.ListItem>
      <Flex
        align="center"
        height={settingsV3 ? '32px' : undefined}
        justify={settingsV3 ? 'start' : undefined}
      >
        {flexProps => (
          <SecondaryNavigation.Link
            {...mergeProps(flexProps, props)}
            to={to}
            end={index}
            leadingItems={settingsV3 ? badgeElement : undefined}
            trailingItems={settingsV3 ? null : badgeElement}
            analyticsItemName={id ? `settings_${id}` : undefined}
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

function SettingsNavBadge({badge}: {badge: string | number | null | ReactElement}) {
  if (badge === 'new' || badge === 'beta' || badge === 'alpha') {
    return <FeatureBadge type={badge} />;
  }
  if (badge === 'warning') {
    return (
      <Tooltip title={t('This setting needs review')} position="right">
        <StyledBadge variant="warning">{badge}</StyledBadge>
      </Tooltip>
    );
  }
  if (typeof badge === 'string' || typeof badge === 'number') {
    return <StyledBadge variant="muted">{badge}</StyledBadge>;
  }

  return badge;
}

const StyledBadge = styled(Badge)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.font.size.xs};
  padding: 3px ${p => p.theme.space.sm};
  vertical-align: middle;
`;
