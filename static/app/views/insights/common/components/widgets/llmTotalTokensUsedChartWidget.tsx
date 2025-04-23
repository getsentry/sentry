import {useParams} from 'sentry/utils/useParams';
import BaseLlmTotalTokensUsedChartWidget from 'sentry/views/insights/common/components/widgets/base/baseLlmTotalTokensUsedChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

export default function LlmTotalTokensUsedChartWidget(props: LoadableChartWidgetProps) {
  const {groupId} = useParams();

  return (
    <BaseLlmTotalTokensUsedChartWidget
      {...props}
      id="llmTotalTokensUsedChartWidget"
      groupId={groupId}
    />
  );
}
