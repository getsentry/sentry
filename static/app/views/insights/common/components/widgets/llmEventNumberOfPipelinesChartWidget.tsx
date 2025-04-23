import {useParams} from 'sentry/utils/useParams';
import BaseLlmNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/base/baseLlmNumberOfPipelinesChartWidget';
import {useAiPipelineGroup} from 'sentry/views/insights/common/components/widgets/hooks/useAiPipelineGroup';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

export default function LlmEventNumberOfPipelinesChartWidget(
  props: LoadableChartWidgetProps
) {
  const params = useParams<{groupId: string; eventId?: string}>();
  const {groupId, isPending, error} = useAiPipelineGroup(params);

  return (
    <BaseLlmNumberOfPipelinesChartWidget
      {...props}
      id="llmEventNumberOfPipelinesChartWidget"
      groupId={groupId}
      isLoading={isPending}
      error={error}
    />
  );
}
