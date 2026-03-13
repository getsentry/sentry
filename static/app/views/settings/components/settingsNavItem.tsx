import type {ReactElement} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Badge, FeatureBadge} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {HookOrDefault} from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';

type Props = {
  label: React.ReactNode;
  to: string;
  badge?: string | number | null | ReactElement;
  id?: string;
  index?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

const LabelHook = HookOrDefault({
  hookName: 'sidebar:item-label',
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

export function SettingsNavItem({badge, label, id, to, index, ...props}: Props) {
  return (
    <SecondaryNavigation.Item
      to={to}
      end={index}
      trailingItems={badge ? <SettingsNavBadge badge={badge} /> : null}
      analyticsItemName={id ? `settings_${id}` : undefined}
      {...props}
    >
      <LabelHook id={id}>{label}</LabelHook>
    </SecondaryNavigation.Item>
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
