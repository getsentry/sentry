import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';
import {Row} from 'sentry/components/performance/waterfall/row';
import space from 'sentry/styles/space';

import {EnhancedProcessedSpanType} from './types';

type Props = {
  children: ReactNode[];
  expandHiddenSpans: (spans: EnhancedProcessedSpanType[]) => void;
  spans: EnhancedProcessedSpanType[];
};

export function HiddenSpansBar(props: Props) {
  const {spans} = props;

  const handleClick = () => {
    props.expandHiddenSpans(spans);
  };

  return <RowContainer onClick={handleClick}>{props.children}</RowContainer>;
}

const RowContainer = styled(Row)`
  display: block;
  cursor: pointer;
  line-height: ${ROW_HEIGHT}px;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  color: ${p => p.theme.gray300};
  background-color: ${p => p.theme.backgroundSecondary};
  outline: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeSmall};

  z-index: ${p => p.theme.zIndex.traceView.rowInfoMessage};

  > * + * {
    margin-left: ${space(2)};
  }
`;
