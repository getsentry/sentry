import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';

interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
  cursor?: 'pointer' | 'default';
  showBorder?: boolean;
  visible?: boolean;
}

export const Row = styled('div')<RowProps>`
  display: ${p => (p.visible ? 'block' : 'none')};
  border-top: ${p => (p.showBorder ? `1px solid ${p.theme.border}` : null)};
  margin-top: ${p => (p.showBorder ? '-1px' : null)}; /* to prevent offset on toggle */
  position: relative;
  overflow: hidden;
  min-height: ${ROW_HEIGHT}px;
  cursor: ${p => p.cursor ?? 'pointer'};
  transition: background-color 0.15s ease-in-out;

  &:last-child {
    & > [data-component='span-detail'] {
      border-bottom: none !important;
    }
  }
`;
