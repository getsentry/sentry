import {LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import LlmEventNumberOfPipelinesChartWidget from 'sentry/views/insights/common/components/widgets/llmEventNumberOfPipelinesChartWidget';
import LlmEventTotalTokensUsedChartWidget from 'sentry/views/insights/common/components/widgets/llmEventTotalTokensUsedChartWidget';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export default function LLMMonitoringSection() {
  const moduleUrl = useModuleURL('ai');

  const actions = (
    <ButtonBar gap={1}>
      <LinkButton size="xs" icon={<IconOpen />} to={moduleUrl}>
        {t('View in LLM Monitoring')}
      </LinkButton>
    </ButtonBar>
  );

  return (
    <InterimSection
      title={t('LLM monitoring')}
      type={SectionKey.LLM_MONITORING}
      help={t('Charts showing how many tokens are being used')}
      actions={actions}
    >
      <ModuleLayout.Layout>
        <ModuleLayout.Half>
          <LlmEventTotalTokensUsedChartWidget />
        </ModuleLayout.Half>
        <ModuleLayout.Half>
          <LlmEventNumberOfPipelinesChartWidget />
        </ModuleLayout.Half>
      </ModuleLayout.Layout>
    </InterimSection>
  );
}
