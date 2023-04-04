import styled from '@emotion/styled';

import {toPercent} from 'sentry/components/performance/waterfall/utils';

import * as CursorGuideHandler from './cursorGuideHandler';

const SpanBarCursorGuide = () => {
  return (
    <CursorGuideHandler.Consumer>
      {({
        showCursorGuide,
        traceViewMouseLeft,
      }: {
        showCursorGuide: boolean;
        traceViewMouseLeft: number | undefined;
      }) => {
        if (!showCursorGuide || !traceViewMouseLeft) {
          return null;
        }

        return (
          <CursorGuide
            style={{
              left: toPercent(traceViewMouseLeft),
            }}
          />
        );
      }}
    </CursorGuideHandler.Consumer>
  );
};

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: ${p => p.theme.red300};
  transform: translateX(-50%);
  height: 100%;
`;

export default SpanBarCursorGuide;
