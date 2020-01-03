import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import Badge from 'app/components/badge';
import HookOrDefault from 'app/components/hookOrDefault';
import Tag from 'app/views/settings/components/tag';

type Props = {
  to: React.ComponentProps<Link>['to'];
  label: React.ReactNode;
  badge?: string | number | null;
  index?: boolean;
  id?: string;
};

const SettingsNavItem = ({badge, label, index, id, ...props}: Props) => {
  const LabelHook = HookOrDefault({
    hookName: 'sidebar:item-label',
    defaultComponent: ({children}) => <React.Fragment>{children}</React.Fragment>,
  });

  const renderedBadge =
    badge === 'new' ? (
      <StyledTag priority="warning" size="small" border>
        {badge}
      </StyledTag>
    ) : (
      <Badge text={badge} />
    );

  return (
    <StyledNavItem onlyActiveOnIndex={index} activeClassName="active" {...props}>
      <LabelHook id={id}>{label}</LabelHook>

      {badge ? renderedBadge : null}
    </StyledNavItem>
  );
};

const StyledTag = styled(Tag)`
  margin-left: 0.25em;
`;

const StyledNavItem = styled(Link)`
  display: block;
  color: ${p => p.theme.gray2};
  font-size: 14px;
  line-height: 30px;
  position: relative;

  &.active {
    color: ${p => p.theme.gray5};

    &:before {
      background: ${p => p.theme.purple};
    }
  }

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray5};
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
