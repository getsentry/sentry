import styled from 'react-emotion';

import space from 'app/styles/space';

export const zIndex = {
  minimapContainer: 999999998,
  dividerLine: 999999,
  spanTreeToggler: 99999,
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
  border-top: ${p => (p.showBorder ? `1px solid ${p.theme.gray1}` : null)};
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

  &:hover {
    background-color: rgba(189, 180, 199, 0.1);
  }
`;

export const SpanRowMessage = styled(SpanRow)`
  display: block;

  cursor: auto;

  color: #4a3e56;
  font-size: 12px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  padding-left: ${space(1)};
  padding-right: ${space(1)};

  background-color: #f1f5fb !important;

  outline: 1px solid #c9d4ea;

  z-index: 99999;
`;
