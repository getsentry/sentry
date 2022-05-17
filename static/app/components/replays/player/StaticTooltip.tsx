import React, {useMemo} from 'react';
import styled from '@emotion/styled';

import {TooltipUI} from 'sentry/components/tooltip';
import domId from 'sentry/utils/domId';

type Props = {
  forceVisible: boolean;
  percent: number;
  title: React.ReactNode;
};

function StaticTooltip({forceVisible, percent, title}: Props) {
  const tooltipId = useMemo(() => domId('tooltip-'), []);

  const isVisible = forceVisible;

  return (
    <PositionedTooltip percent={percent}>
      <TooltipUI
        isVisible={isVisible}
        position="top"
        popperStyle={{opacity: 1, background: 'red'}}
        title={title}
        tooltipId={tooltipId}
      />
    </PositionedTooltip>
  );
}

const PositionedTooltip = styled('div')<{percent: number}>`
  position: absolute;
  top: 0;
  left: ${p => p.percent * 100}%;
  width: 10px;
  height: 100%;
  background: red;
`;

export default StaticTooltip;
