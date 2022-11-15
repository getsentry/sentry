import {Fragment, ReactElement} from 'react';
import {Link as RouterLink} from 'react-router';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import FeatureBadge from 'sentry/components/featureBadge';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  label: React.ReactNode;
  to: React.ComponentProps<RouterLink>['to'];
  badge?: string | number | null | ReactElement;
  id?: string;
  index?: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

const SettingsNavItem = ({badge, label, index, id, ...props}: Props) => {
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

  return (
    <StyledNavItem onlyActiveOnIndex={index} activeClassName="active" {...props}>
      <LabelHook id={id}>{label}</LabelHook>
      {badge ? renderedBadge : null}
    </StyledNavItem>
  );
};

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

  &.focus-visible {
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
  font-weight: 400;
  height: auto;
  line-height: 1;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 3px ${space(0.75)};
  vertical-align: middle;
`;

export default SettingsNavItem;
