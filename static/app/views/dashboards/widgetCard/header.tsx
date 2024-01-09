import React from 'react';
import styled from '@emotion/styled';

import {HeaderTitle} from 'sentry/components/charts/styles';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {ExtractedMetricsTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';

import {Widget} from '../types';

import {WidgetDescription, WidgetTitleRow} from './index';

export function WidgetCardHeader({
  widget,
  title = null,
  thresholdColorIndicator = null,
  contextMenu = null,
}: {
  widget: Widget;
  contextMenu?: React.ReactNode;
  thresholdColorIndicator?: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <WidgetHeaderWrapper>
      <WidgetHeaderDescription>
        <WidgetTitleRow>
          <WidgetTitle>{title ?? widget.title}</WidgetTitle>
          {thresholdColorIndicator}
          <ExtractedMetricsTag queryKey={widget} />
        </WidgetTitleRow>
        {widget.description && (
          <Tooltip
            title={widget.description}
            containerDisplayMode="grid"
            showOnlyOnOverflow
            isHoverable
          >
            <WidgetDescription>{widget.description}</WidgetDescription>
          </Tooltip>
        )}
      </WidgetHeaderDescription>
      {contextMenu}
    </WidgetHeaderWrapper>
  );
}

const WidgetTitle = styled(HeaderTitle)`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const WidgetHeaderWrapper = styled('div')`
  padding: ${space(2)} ${space(1)} 0 ${space(3)};
  min-height: 36px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const WidgetHeaderDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;
