import type {CSSProperties} from 'react';
import type {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

import * as ChonkBadge from './badge.chonk';

function makeBadgeTheme(
  props: BadgeProps,
  theme: ReturnType<typeof useTheme>
): CSSProperties {
  switch (props.type) {
    case 'alpha':
      return {
        background: `linear-gradient(90deg, ${theme.colors.pink400}, ${theme.colors.yellow400})`,
        color: theme.colors.white,
      };
    case 'beta':
      return {
        background: `linear-gradient(90deg, ${theme.colors.blue400}, ${theme.colors.pink400})`,
        color: theme.colors.white,
      };
    // @TODO(jonasbadalic) default, experimental and internal all look the same and should be consolidated
    case 'default':
    case 'experimental':
    case 'internal':
      return {
        background: theme.colors.gray100,
        color: theme.colors.gray800,
      };
    case 'new':
      return {
        background: `linear-gradient(90deg, ${theme.colors.blue400}, ${theme.colors.green400})`,
        color: theme.colors.white,
      };
    case 'warning':
      return {
        background: theme.colors.yellow400,
        color: theme.colors.gray800,
      };
    default:
      unreachable(props.type);
      throw new TypeError(`Unsupported badge type: ${props.type}`);
  }
}

type BadgeType =
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

  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 20px;
  line-height: 20px;
  border-radius: 20px;
  font-weight: ${p => p.theme.font.weight.regular};
  font-size: ${p => p.theme.font.size.xs};
  padding: 0 ${space(0.75)};
  transition: background ${p => p.theme.motion.snap.fast};

  /* @TODO(jonasbadalic) why are these needed? */
  margin-left: ${space(0.5)};
  position: relative;
`;

const BadgeComponent = withChonk(
  StyledBadge,
  ChonkBadge.ChonkBadge,
  ChonkBadge.chonkBadgePropMapping
);
