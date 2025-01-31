import type {ReactElement} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import Badge from 'sentry/components/badge/badge';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';

type Props = {
  label: React.ReactNode;
  to: LocationDescriptor;
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
  if (badge === 'new') {
    return <FeatureBadge type="new" />;
  }
  if (badge === 'beta') {
    return <FeatureBadge type="beta" />;
  }
  if (badge === 'warning') {
    return (
      <Tooltip title={t('This setting needs review')} position="right">
        <StyledBadge text={badge} type="warning" />
      </Tooltip>
    );
  }
  if (typeof badge === 'string' || typeof badge === 'number') {
    return <StyledBadge text={badge} />;
  }

  return badge;
}

function SettingsNavItem({badge, label, id, to, ...props}: Props) {
  // TODO(malwilley): Support `end` prop in `SecondaryNav.Item`
  return (
    <SecondaryNav.Item to={locationDescriptorToTo(to)} {...props}>
      <LabelHook id={id}>{label}</LabelHook>
      {badge ? <SettingsNavBadge badge={badge} /> : null}
    </SecondaryNav.Item>
  );
}

const StyledBadge = styled(Badge)`
  font-weight: ${p => p.theme.fontWeightNormal};
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 3px ${space(0.75)};
  vertical-align: middle;
`;

export default SettingsNavItem;
