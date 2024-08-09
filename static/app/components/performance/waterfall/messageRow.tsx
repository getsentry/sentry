import styled from '@emotion/styled';

import {ROW_HEIGHT} from 'sentry/components/performance/waterfall/constants';
import {Row} from 'sentry/components/performance/waterfall/row';

export const MessageRow = styled(Row)`
  display: block;
  line-height: ${ROW_HEIGHT}px;
  padding-left: ${p => p.theme.space(1)};
  padding-right: ${p => p.theme.space(1)};
  color: ${p => p.theme.gray300};
  background-color: ${p => p.theme.backgroundSecondary};
  outline: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeSmall};

  z-index: ${p => p.theme.zIndex.traceView.rowInfoMessage};

  > * + * {
    margin-left: ${p => p.theme.space(2)};
  }
`;
