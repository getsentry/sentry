import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  children?: React.ReactNode;
  type?: undefined | 'error' | 'warning';
};

export const ReleaseDetailsTable = styled('div')<{noMargin?: boolean}>`
  ${p => (p.noMargin ? 'margin-bottom: 0;' : null)}
`;

export function ReleaseDetailsTableRow({type, children}: Props) {
  return <Row type={type}>{children}</Row>;
}

const Row = styled('div')<{type: Props['type']}>`
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(0.5)} ${space(1)};
  font-weight: normal;
  line-height: inherit;

  background-color: ${p => {
    switch (p.type) {
      case 'error':
        return p.theme.red100 + ' !important';
      case 'warning':
        return 'var(--background-warning-default, rgba(245, 176, 0, 0.09)) !important';
      default:
        return 'inherit';
    }
  }};
  &:nth-of-type(2n-1) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;
