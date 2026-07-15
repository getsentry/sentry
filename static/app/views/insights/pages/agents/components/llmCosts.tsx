import {InfoText} from '@sentry/scraps/info';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

const COST_DOCS_URL = 'https://docs.sentry.io/ai/monitoring/agents/costs/';

interface LLMCostsProps {
  cost: number | string | null;
  className?: string;
}

/**
 * Renders an LLM cost via `formatLLMCosts`. A missing (null) or exactly-zero
 * cost both mean "no cost recorded" and render as a `—` wrapped in a tooltip
 * explaining how cost is calculated, so it reads as "no data" rather than a
 * free ($0) call.
 */
export function LLMCosts({cost, className}: LLMCostsProps) {
  if (cost === null || Number(cost) === 0) {
    return (
      <InfoText
        className={className}
        variant="inherit"
        title={tct(
          'No cost recorded. Cost is calculated from token usage and model pricing on your AI spans. [link:Learn more].',
          {link: <ExternalLink href={COST_DOCS_URL} />}
        )}
      >
        {'—'}
      </InfoText>
    );
  }

  return (
    <span
      className={className}
      title={Number(cost).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 8,
      })}
    >
      {formatLLMCosts(cost)}
    </span>
  );
}
