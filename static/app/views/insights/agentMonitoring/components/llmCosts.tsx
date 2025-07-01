import {formatLLMCosts} from 'sentry/views/insights/agentMonitoring/utils/formatLLMCosts';

interface LLMCostsProps {
  cost: number | string;
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
      {formatLLMCosts(cost)}
    </span>
  );
}
