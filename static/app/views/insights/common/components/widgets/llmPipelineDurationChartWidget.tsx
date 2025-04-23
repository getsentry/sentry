import {useParams} from 'sentry/utils/useParams';
import BaseLlmPipelineDurationChartWidget from 'sentry/views/insights/common/components/widgets/base/baseLlmPipelineDurationChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

export default function LlmPipelineDurationChartWidget(props: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  return (
    <BaseLlmPipelineDurationChartWidget
      {...props}
      id="llmPipelineDurationChartWidget"
      groupId={groupId}
    />
  );
}
