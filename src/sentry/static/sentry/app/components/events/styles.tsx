import styled from '@emotion/styled';

import space from 'app/styles/space';
import theme from 'app/utils/theme';

const COLORS = {
  default: {
    background: theme.gray100,
    border: theme.border,
  },
  danger: {
    background: theme.red100,
    // TODO(theme) This pink is non-standard
    border: '#e7c0bc',
  },
} as const;

export const DataSection = styled('div')`
  padding: ${space(2)} 0;
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(3)} ${space(4)} 0 40px;
  }
`;

type BannerProps = {
  priority: 'default' | 'danger';
};

export const BannerContainer = styled('div')<BannerProps>`
  font-size: ${p => p.theme.fontSizeMedium};

  background: ${p => COLORS[p.priority].background};
  border-top: 1px solid ${p => COLORS[p.priority].border};
  border-bottom: 1px solid ${p => COLORS[p.priority].border};

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
  padding: ${space(2)} ${space(4)} ${space(2)} 40px;
  margin-bottom: 0;

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
    color: ${p => p.theme.gray500};
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
