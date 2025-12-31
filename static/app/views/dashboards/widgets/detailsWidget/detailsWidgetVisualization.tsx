import styled from '@emotion/styled';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {DatabaseSpanDescription} from 'sentry/views/insights/common/components/spanDescription';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {resolveSpanModule} from 'sentry/views/insights/common/utils/resolveSpanModule';
import {DomainStatusLink} from 'sentry/views/insights/http/components/domainStatusLink';
import {ModuleName, SpanFields, type SpanResponse} from 'sentry/views/insights/types';

import {DEEMPHASIS_COLOR_NAME, LOADING_PLACEHOLDER} from './settings';

interface DetailsWidgetVisualizationProps {
  span: Pick<SpanResponse, DefaultDetailWidgetFields>;
}

export function DetailsWidgetVisualization(props: DetailsWidgetVisualizationProps) {
  const {span} = props;

  const spanOp = span[SpanFields.SPAN_OP] ?? '';
  const spanDescription = span[SpanFields.SPAN_DESCRIPTION] ?? '';
  const spanGroup = span[SpanFields.SPAN_GROUP];
  const spanCategory = span[SpanFields.SPAN_CATEGORY];

  const moduleName = resolveSpanModule(spanOp, spanCategory);

  if (moduleName === ModuleName.DB) {
    return (
      <DatabaseSpanDescription
        showBorder={false}
        shouldClipHeight={false}
        groupId={spanGroup}
        preliminaryDescription={spanDescription}
      />
    );
  }

  if (moduleName === ModuleName.HTTP) {
    return (
      <HttpSpanVisualization
        spanId={span[SpanFields.ID]}
        spanOp={spanOp}
        spanDescription={spanDescription}
      />
    );
  }

  return <Wrapper>{`${spanOp} - ${spanDescription}`}</Wrapper>;
}

function HttpSpanVisualization(props: {
  spanDescription: string;
  spanId: string;
  spanOp: string;
}): React.ReactNode {
  const {spanId, spanOp, spanDescription} = props;

  const {data: httpSpan, isLoading} = useSpans(
    {
      search: MutableSearch.fromQueryObject({
        id: spanId,
      }),
      fields: [SpanFields.SPAN_DOMAIN],
    },
    'api.dashboards.details-widget.domain-status'
  );

  if (isLoading) {
    return <LoadingPlaceholder>{LOADING_PLACEHOLDER}</LoadingPlaceholder>;
  }

  if (!httpSpan?.[0]?.[SpanFields.SPAN_DOMAIN]) {
    return <Wrapper>{`${spanOp} - ${spanDescription}`}</Wrapper>;
  }

  return (
    <HttpSpanVisualizationWrapper>
      <h1>{httpSpan[0][SpanFields.SPAN_DOMAIN]}</h1>
      <DomainStatusLink domain={httpSpan[0][SpanFields.SPAN_DOMAIN]} />
    </HttpSpanVisualizationWrapper>
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

const HttpSpanVisualizationWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  height: 100%;
  padding: ${p => p.theme.space.xl};
`;

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

  color: ${p => p.theme.tokens.content.primary};

  container-type: size;
  container-name: auto-resize-parent;
  padding: ${p => p.theme.space.xl};

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
