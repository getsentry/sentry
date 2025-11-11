import {formatLLMCosts} from 'sentry/views/insights/pages/agents/utils/formatLLMCosts';

interface LLMCostsProps {
  cost: number | string | null;
  className?: string;
}

export function LLMCosts({cost, className}: LLMCostsProps) {
  return (
    <span
      className={className}
      title={Number(cost).toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 8,
      })}
    >
      {cost ? formatLLMCosts(cost) : '—'}
    </span>
  );
}
