import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

export const DataSection = styled('div')`
  display: flex;
  flex-direction: column;
  margin: 0;

  /* Padding aligns with Layout.Body */
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space['3xl']};
  }
`;

type BannerProps = {
  priority: 'default' | 'danger' | 'success';
};

function getColors({priority, theme}: BannerProps & {theme: Theme}) {
  const COLORS = {
    default: {
      background: theme.tokens.background.secondary,
      border: theme.tokens.border.primary,
    },
    danger: {
      background: theme.colors.red100,
      border: theme.colors.red200,
    },
    success: {
      background: theme.colors.green100,
      border: theme.colors.green200,
    },
  } as const;

  return COLORS[priority];
}

export const BannerContainer = styled('div')<BannerProps>`
  font-size: ${p => p.theme.font.size.md};
  background: ${p => getColors(p).background};
  border-top: 1px solid ${p => getColors(p).border};
  border-bottom: 1px solid ${p => getColors(p).border};

  /* Muted box & processing errors are in different parts of the DOM */
  & + ${DataSection}:first-child, & + div > ${DataSection}:first-child {
    border-top: 0;
  }
`;

export const BannerSummary = styled('p')`
  display: flex;
  align-items: flex-start;
  margin-bottom: 0;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
  }

  /* Get icons in top right of content box */
  & > .icon,
  & > svg {
    flex-shrink: 0;
    flex-grow: 0;
    margin-right: ${p => p.theme.space.md};
    margin-top: 2px;
  }

  & > span {
    flex-grow: 1;
  }

  & > a {
    align-self: flex-end;
  }
`;
