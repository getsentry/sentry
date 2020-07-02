import {Link} from 'react-router';
import React from 'react';
import styled from '@emotion/styled';

import Badge from 'app/components/badge';
import HookOrDefault from 'app/components/hookOrDefault';
import FeatureBadge from 'app/components/featureBadge';

type Props = {
  to: React.ComponentProps<Link>['to'];
  label: React.ReactNode;
  badge?: string | number | null;
  index?: boolean;
  id?: string;
  onClick?: (e: React.MouseEvent) => void;
};

const SettingsNavItem = ({badge, label, index, id, ...props}: Props) => {
  const LabelHook = HookOrDefault({
    hookName: 'sidebar:item-label',
    defaultComponent: ({children}) => <React.Fragment>{children}</React.Fragment>,
  });

  const renderedBadge =
    badge === 'new' ? <FeatureBadge type="new" /> : <Badge text={badge} />;

  return (
    <StyledNavItem onlyActiveOnIndex={index} activeClassName="active" {...props}>
      <LabelHook id={id}>{label}</LabelHook>

      {badge ? renderedBadge : null}
    </StyledNavItem>
  );
};

const StyledNavItem = styled(Link)`
  display: block;
  color: ${p => p.theme.gray500};
  font-size: 14px;
  line-height: 30px;
  position: relative;

  &.active {
    color: ${p => p.theme.gray800};

    &:before {
      background: ${p => p.theme.purple400};
    }
  }

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray800};
    outline: none;
  }

  &.focus-visible {
    outline: none;
    background: #f2eff5;
    padding: 0 15px;
    margin: 0 -15px;
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

export default SettingsNavItem;
