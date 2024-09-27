import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {
  BigNumberWidgetVisualization,
  type Props as BigNumberWidgetVisualizationProps,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {
  type Props as WidgetFrameProps,
  WidgetFrame,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

interface Props
  extends Omit<WidgetFrameProps, 'children'>,
    BigNumberWidgetVisualizationProps {}

export function BigNumberWidget(props: Props) {
  return (
    <WidgetFrame
      title={props.title}
      description={props.description}
      showDescriptionInTooltip={props.showDescriptionInTooltip}
      actions={props.actions}
    >
      <BigNumberResizeWrapper>
        <BigNumberWidgetVisualization
          data={props.data}
          previousPeriodData={props.previousPeriodData}
          preferredPolarity={props.preferredPolarity}
          meta={props.meta}
          isLoading={props.isLoading}
          error={props.error}
        />
      </BigNumberResizeWrapper>
    </WidgetFrame>
  );
}

const BigNumberResizeWrapper = styled('div')`
  position: relative;
  flex-grow: 1;
  margin-top: ${space(1)};
`;
