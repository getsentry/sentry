import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {
  BigNumberWidgetContents,
  type Props as BigNumberWidgetContentsProps,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetContents';
import {
  type Props as WidgetFrameProps,
  WidgetFrame,
} from 'sentry/views/dashboards/widgets/common/widgetFrame';

interface Props<FieldNames extends string[]>
  extends Omit<WidgetFrameProps, 'children'>,
    BigNumberWidgetContentsProps<FieldNames> {}

export function BigNumberWidget<FieldNames extends string[]>(props: Props<FieldNames>) {
  return (
    <WidgetFrame title={props.title} description={props.description}>
      <BigNumberResizeWrapper>
        <BigNumberWidgetContents data={props.data} meta={props.meta} />
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
