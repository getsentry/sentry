import {css, type SerializedStyles, type useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {unreachable} from 'sentry/utils/unreachable';

function makeBadgeTheme(
  props: BadgeProps,
  theme: ReturnType<typeof useTheme>
): SerializedStyles {
  switch (props.type) {
    case 'alpha':
      return css`
        background: linear-gradient(90deg, ${theme.pink300}, ${theme.yellow300});
        color: ${theme.white};
      `;
    case 'beta':
      return css`
        background: linear-gradient(90deg, ${theme.purple300}, ${theme.pink300});
        color: ${theme.white};
      `;
    case 'default':
    case 'experimental':
    case 'internal':
      return css`
        background: ${theme.gray100};
        color: ${theme.gray500};
      `;
    case 'new':
      return css`
        background: linear-gradient(90deg, ${theme.blue300}, ${theme.green300});
        color: ${theme.white};
      `;
    case 'warning':
      return css`
        background: ${theme.yellow300};
        color: ${theme.gray500};
      `;
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
  // @TODO(jonasbadalic) "default" is bad API decision
  | 'experimental'
  | 'internal'
  | 'default';

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  children: React.ReactNode;
  type: BadgeType;
}

export const Badge = styled('span')<BadgeProps>`
  ${p => makeBadgeTheme(p, p.theme)}

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
