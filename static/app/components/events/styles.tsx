import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

export const DataSection = styled('div')`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;

  /* Padding aligns with Layout.Body */
  padding: ${space(3)} ${space(2)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)} ${space(3)};
  }
`;

type BannerProps = {
  priority: 'default' | 'danger' | 'success';
};

function getColors({priority, theme}: BannerProps & {theme: Theme}) {
  const COLORS = {
    default: {
      background: theme.backgroundSecondary,
      border: theme.border,
    },
    danger: {
      background: theme.alert.error.backgroundLight,
      border: theme.alert.error.border,
    },
    success: {
      background: theme.alert.success.backgroundLight,
      border: theme.alert.success.border,
    },
  } as const;

  return COLORS[priority];
}

export const BannerContainer = styled('div')<BannerProps>`
  font-size: ${p => p.theme.fontSizeMedium};

  background: ${p => getColors(p).background};
  border-top: 1px solid ${p => getColors(p).border};
  border-bottom: 1px solid ${p => getColors(p).border};

  /* Muted box & processing errors are in different parts of the DOM */
  &
    + ${/* sc-selector */ DataSection}:first-child,
    &
    + div
    > ${/* sc-selector */ DataSection}:first-child {
    border-top: 0;
  }
`;

export const BannerSummary = styled('p')`
  display: flex;
  align-items: flex-start;
  margin-bottom: 0;
  padding: ${space(2)} ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding: ${space(2)} ${space(4)};
  }

  /* Get icons in top right of content box */
  & > .icon,
  & > svg {
    flex-shrink: 0;
    flex-grow: 0;
    margin-right: ${space(1)};
    margin-top: 2px;
  }

  & > span {
    flex-grow: 1;
  }

  & > a {
    align-self: flex-end;
  }
`;

export const CauseHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(3)};

  & button,
  & h3 {
    color: ${p => p.theme.gray300};
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    text-transform: uppercase;
  }

  & h3 {
    margin-bottom: 0;
  }

  & button {
    background: none;
    border: 0;
    outline: none;
    padding: 0;
  }
`;
