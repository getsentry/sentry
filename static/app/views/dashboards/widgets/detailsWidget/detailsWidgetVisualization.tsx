import styled from '@emotion/styled';

import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {SpanFields, type SpanResponse} from 'sentry/views/insights/types';

import {DEEMPHASIS_COLOR_NAME, LOADING_PLACEHOLDER} from './settings';

interface DetailsWidgetVisualizationProps {
  span: Pick<SpanResponse, DefaultDetailWidgetFields>;
}

export function DetailsWidgetVisualization(props: DetailsWidgetVisualizationProps) {
  const {span} = props;

  const spanOp = span[SpanFields.SPAN_OP];
  const spanDescription = span[SpanFields.SPAN_DESCRIPTION];
  const spanGroup = span[SpanFields.SPAN_GROUP];
  const spanCategory = span[SpanFields.SPAN_CATEGORY];

  const moduleName = resolveSpanModule(spanOp, spanCategory);

  if (spanOp === 'db') {
    return (
      <FullSpanDescription
        group={spanGroup}
        shortDescription={spanDescription}
        moduleName={moduleName}
      />
    );
  }

  // String values don't support differences, thresholds, max values, or anything else.
  return (
    <Wrapper>
      {spanOp} - {spanDescription}
    </Wrapper>
  );
}

function Wrapper({children}: any) {
  return (
    <GrowingWrapper>
      <AutoResizeParent>
        <AutoSizedText>{children}</AutoSizedText>
      </AutoResizeParent>
    </GrowingWrapper>
  );
}

// Takes up 100% of the parent. If within flex context, grows to fill.
// Otherwise, takes up 100% horizontally and vertically
const GrowingWrapper = styled('div')`
  position: relative;
  flex-grow: 1;
  height: 100%;
  width: 100%;
`;

const AutoResizeParent = styled('div')`
  position: absolute;
  inset: 0;

  color: ${p => p.theme.headingColor};

  container-type: size;
  container-name: auto-resize-parent;

  * {
    line-height: 1;
    text-align: left !important;
  }
`;

const LoadingPlaceholder = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
  font-size: ${p => p.theme.fontSize.lg};
`;

DetailsWidgetVisualization.LoadingPlaceholder = function () {
  return <LoadingPlaceholder>{LOADING_PLACEHOLDER}</LoadingPlaceholder>;
};
