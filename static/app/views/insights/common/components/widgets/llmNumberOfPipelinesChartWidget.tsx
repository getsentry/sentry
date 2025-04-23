import {useParams} from 'sentry/utils/useParams';
import BaseLlmNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/base/baseLlmNumberOfPipelinesChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

export default function LlmNumberOfPipelinesChartWidget(props: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  return (
    <BaseLlmNumberOfPipelinesChartWidget
      {...props}
      id="llmNumberOfPipelinesChartWidget"
      groupId={groupId}
    />
  );
}
