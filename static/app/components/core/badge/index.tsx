import type {CSSProperties} from 'react';
import type {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkBadge from './index.chonk';

function makeBadgeTheme(
  props: BadgeProps,
  theme: ReturnType<typeof useTheme>
): CSSProperties {
  switch (props.type) {
    case 'alpha':
      return {
        background: `linear-gradient(90deg, ${theme.pink300}, ${theme.yellow300})`,
        color: theme.white,
      };
    case 'beta':
      return {
        background: `linear-gradient(90deg, ${theme.purple300}, ${theme.pink300})`,
        color: theme.white,
      };
    // @TODO(jonasbadalic) default, experimental and internal all look the same and should be consolidated
    case 'default':
    case 'experimental':
    case 'internal':
      return {
        background: theme.gray100,
        color: theme.gray500,
      };
    case 'new':
      return {
        background: `linear-gradient(90deg, ${theme.blue300}, ${theme.green300})`,
        color: theme.white,
      };
    case 'warning':
      return {
        background: theme.yellow300,
        color: theme.gray500,
      };
    default:
      unreachable(props.type);
      throw new TypeError(`Unsupported badge type: ${props.type}`);
  }
}

export type BadgeType =
  | 'alpha'
  | 'beta'
  | 'new'
  | 'warning'
  // @TODO(jonasbadalic) "default" is bad API decision.
  // @TODO(jonasbadalic) default, experimental and internal all look the same...
  | 'experimental'
  | 'internal'
  | 'default';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  type: BadgeType;
}

export function Badge({children, ...props}: BadgeProps) {
  return <BadgeComponent {...props}>{children}</BadgeComponent>;
}

const StyledBadge = styled('span')<BadgeProps>`
  ${p => ({...makeBadgeTheme(p, p.theme)})};

  display: inline-block;
  height: 20px;
  min-width: 20px;
  line-height: 20px;
  border-radius: 20px;
  font-weight: ${p => p.theme.fontWeightBold};
  text-align: center;

  /* @TODO(jonasbadalic) can we standardize this transition? */
  transition: background 100ms linear;

  /* @TODO(jonasbadalic) why are these needed? */
  font-size: 75%;
  padding: 0 5px;
  margin-left: ${space(0.5)};
  position: relative;
`;

const BadgeComponent = withChonk(
  StyledBadge,
  ChonkBadge.ChonkBadge,
  ChonkBadge.chonkBadgePropMapping
);
