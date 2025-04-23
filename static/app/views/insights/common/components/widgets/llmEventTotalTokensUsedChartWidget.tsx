import {useParams} from 'sentry/utils/useParams';
import BaseLlmTotalTokensUsedChartWidget from 'sentry/views/insights/common/components/widgets/base/baseLlmTotalTokensUsedChartWidget';
import {useAiPipelineGroup} from 'sentry/views/insights/common/components/widgets/hooks/useAiPipelineGroup';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

export default function LlmEventTotalTokensUsedChartWidget(
  props: LoadableChartWidgetProps
) {
  const params = useParams<{groupId: string; eventId?: string}>();
  const {groupId, isPending, error} = useAiPipelineGroup(params);

  return (
    <BaseLlmTotalTokensUsedChartWidget
      {...props}
      id="llmEventTotalTokensUsedChartWidget"
      groupId={groupId}
      isLoading={isPending}
      error={error}
    />
  );
}
