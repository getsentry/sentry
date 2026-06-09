import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

const TOKEN_TROUBLESHOOTING_URL =
  'https://docs.sentry.io/ai/monitoring/agents/costs/#troubleshooting';

interface NegativeCostInfoProps {
  cost: number | string;
}

/**
 * Warning indicator for negative LLM costs. Shows a warning icon + the cost
 * value with an InfoText tooltip linking to troubleshooting docs.
 */
export function NegativeCostInfo({cost}: NegativeCostInfoProps) {
  return (
    <Flex align="center" gap="xs">
      <IconWarning legacySize="1em" variant="warning" />
      <InfoText
        variant="warning"
        title={tct(
          'Negative costs indicate an error in token count reporting. [link:Follow this guide] to troubleshoot.',
          {link: <ExternalLink href={TOKEN_TROUBLESHOOTING_URL} />}
        )}
      >
        {formatLLMCosts(cost)}
      </InfoText>
    </Flex>
  );
}
