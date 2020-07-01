import styled from '@emotion/styled';

import space from 'app/styles/space';
import theme from 'app/utils/theme';

export const zIndex = {
  minimapContainer: theme.zIndex.traceView.minimapContainer,
  rowInfoMessage: theme.zIndex.traceView.rowInfoMessage,
  dividerLine: theme.zIndex.traceView.dividerLine,
  spanTreeToggler: theme.zIndex.traceView.spanTreeToggler,
};

export const SPAN_ROW_HEIGHT = 24;

type SpanRowProps = {
  visible?: boolean;
  showBorder?: boolean;
};

type SpanRowAndDivProps = Omit<React.HTMLProps<HTMLDivElement>, keyof SpanRowProps> &
  SpanRowProps;

export const SpanRow = styled('div')<SpanRowAndDivProps>`
  display: ${p => (p.visible ? 'block' : 'none')};
  border-top: ${p => (p.showBorder ? `1px solid ${p.theme.borderDark}` : null)};
  margin-top: ${p => (p.showBorder ? '-1px' : null)}; /* to prevent offset on toggle */
  position: relative;
  overflow: hidden;
  min-height: ${SPAN_ROW_HEIGHT}px;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;

  &:last-child {
    & > [data-component='span-detail'] {
      border-bottom: none !important;
    }
  }
`;

export const SpanRowMessage = styled(SpanRow)`
  display: block;
  cursor: auto;
  line-height: ${SPAN_ROW_HEIGHT}px;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  color: ${p => p.theme.gray500};
  background-color: ${p => p.theme.gray200};
  outline: 1px solid ${p => p.theme.borderDark};
  font-size: ${p => p.theme.fontSizeSmall};

  z-index: ${zIndex.rowInfoMessage};

  > * + * {
    margin-left: ${space(2)};
  }
`;
