import {InfoText} from '@sentry/scraps/info';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

export const TOKEN_TROUBLESHOOTING_URL =
  'https://docs.sentry.io/ai/monitoring/agents/costs/#troubleshooting';

interface NegativeCostInfoProps {
  cost: number | string;
}

/**
 * Warning indicator for negative LLM costs. Shows the cost value with
 * a warning-styled InfoText tooltip linking to troubleshooting docs.
 */
export function NegativeCostInfo({cost}: NegativeCostInfoProps) {
  return (
    <InfoText
      variant="warning"
      title={tct(
        'Negative costs indicate an error in token count reporting. [link:Follow this guide] to troubleshoot.',
        {link: <ExternalLink href={TOKEN_TROUBLESHOOTING_URL} />}
      )}
    >
      {formatLLMCosts(cost)}
    </InfoText>
  );
}
