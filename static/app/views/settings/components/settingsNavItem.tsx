import type {ReactElement} from 'react';
import {Fragment} from 'react';
import {Link as RouterLink} from 'react-router';
import {NavLink as Router6NavLink} from 'react-router-dom';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import Badge from 'sentry/components/badge/badge';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
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

function SettingsNavItem({badge, label, index, id, to, ...props}: Props) {
  const LabelHook = HookOrDefault({
    hookName: 'sidebar:item-label',
    defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
  });

  let renderedBadge: React.ReactNode;

  if (badge === 'new') {
    renderedBadge = <FeatureBadge type="new" />;
  } else if (badge === 'beta') {
    renderedBadge = <FeatureBadge type="beta" />;
  } else if (badge === 'warning') {
    renderedBadge = (
      <Tooltip title={t('This setting needs review')} position="right">
        <StyledBadge text={badge} type="warning" />
      </Tooltip>
    );
  } else if (typeof badge === 'string' || typeof badge === 'number') {
    renderedBadge = <StyledBadge text={badge} />;
  } else {
    renderedBadge = badge;
  }

  if (window.__SENTRY_USING_REACT_ROUTER_SIX) {
    return (
      <StyledNavItem6 end={index} to={locationDescriptorToTo(to)} {...props}>
        <LabelHook id={id}>{label}</LabelHook>
        {badge ? renderedBadge : null}
      </StyledNavItem6>
    );
  }

  return (
    <StyledNavItem to={to} onlyActiveOnIndex={index} activeClassName="active" {...props}>
      <LabelHook id={id}>{label}</LabelHook>
      {badge ? renderedBadge : null}
    </StyledNavItem>
  );
}

const StyledNavItem6 = styled(Router6NavLink)`
  display: block;
  color: ${p => p.theme.gray300};
  font-size: 14px;
  line-height: 30px;
  position: relative;

  &.active {
    color: ${p => p.theme.textColor};

    &:before {
      background: ${p => p.theme.active};
    }
  }

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
    outline: none;
  }

  &:focus-visible {
    outline: none;
    background: ${p => p.theme.backgroundSecondary};
    padding-left: 15px;
    margin-left: -15px;
    border-radius: 3px;

    &:before {
      left: -15px;
    }
  }

  &:before {
    position: absolute;
    content: '';
    display: block;
    top: 4px;
    left: -30px;
    height: 20px;
    width: 4px;
    background: transparent;
    border-radius: 0 2px 2px 0;
  }
`;
const StyledNavItem = styled(RouterLink)`
  display: block;
  color: ${p => p.theme.gray300};
  font-size: 14px;
  line-height: 30px;
  position: relative;

  &.active {
    color: ${p => p.theme.textColor};

    &:before {
      background: ${p => p.theme.active};
    }
  }

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.textColor};
    outline: none;
  }

  &:focus-visible {
    outline: none;
    background: ${p => p.theme.backgroundSecondary};
    padding-left: 15px;
    margin-left: -15px;
    border-radius: 3px;

    &:before {
      left: -15px;
    }
  }

  &:before {
    position: absolute;
    content: '';
    display: block;
    top: 4px;
    left: -30px;
    height: 20px;
    width: 4px;
    background: transparent;
    border-radius: 0 2px 2px 0;
  }
`;

const StyledBadge = styled(Badge)`
  font-weight: ${p => p.theme.fontWeightNormal};
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 3px ${space(0.75)};
  vertical-align: middle;
`;

export default SettingsNavItem;
