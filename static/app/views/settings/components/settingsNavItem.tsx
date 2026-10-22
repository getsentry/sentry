import type {ReactElement, ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Badge, FeatureBadge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
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
  leadingItems?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

const LabelHook = OverrideOrDefault({
  overrideName: 'sidebar:item-label',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

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

export function SettingsNavItem({
  badge,
  label,
  id,
  to,
  index,
  leadingItems,
  ...props
}: Props) {
  const settingsV3 = useSettingsV3();
  const badgeElement = badge ? <SettingsNavBadge badge={badge} /> : null;
  const hasLeadingBadge =
    settingsV3 &&
    !leadingItems &&
    (badge === 'new' || badge === 'beta' || badge === 'alpha');

  return (
    <SecondaryNavigation.ListItem>
      <SecondaryNavigation.Link
        to={to}
        end={index}
        leadingItems={
          settingsV3 ? (
            <Flex
              align="center"
              justify="center"
              width="24px"
              height="24px"
              flexShrink={0}
            >
              {leadingItems ?? (hasLeadingBadge ? badgeElement : null)}
            </Flex>
          ) : (
            leadingItems
          )
        }
        trailingItems={hasLeadingBadge ? null : badgeElement}
        analyticsItemName={id ? `settings_${id}` : undefined}
        {...props}
      >
        <LabelHook id={id}>{label}</LabelHook>
      </SecondaryNavigation.Link>
    </SecondaryNavigation.ListItem>
  );
}

const StyledBadge = styled(Badge)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.font.size.xs};
  padding: 3px ${p => p.theme.space.sm};
  vertical-align: middle;
`;
