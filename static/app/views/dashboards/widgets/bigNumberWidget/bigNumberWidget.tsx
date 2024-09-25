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
    <WidgetFrame title={props.title} description={props.description}>
      <BigNumberResizeWrapper>
        <BigNumberWidgetVisualization
          data={props.data}
          meta={props.meta}
          isLoading={props.isLoading}
          error={props.error}
        />
      </BigNumberResizeWrapper>
    </WidgetFrame>
  );
}

const BigNumberResizeWrapper = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  margin: ${space(1)} ${space(3)} ${space(3)} ${space(3)};
`;
