import {ExternalLink} from '@sentry/scraps/link';

import {InlineChip} from './inlineChip';
import {IntegrationIcon} from './integrationChip';

interface ExternalIssueChipProps {
  label: string;
  location: string;
  provider: string;
}

function getExternalIssueLabel({
  label,
  provider,
}: Pick<ExternalIssueChipProps, 'label' | 'provider'>) {
  const providerPrefix = `${provider}:`;

  if (label.toLowerCase().startsWith(providerPrefix.toLowerCase())) {
    return label.slice(providerPrefix.length).trim();
  }

  return label;
}

export function ExternalIssueChip({label, location, provider}: ExternalIssueChipProps) {
  return (
    <ExternalLink href={location}>
      <InlineChip interactive tone="accent">
        <IntegrationIcon provider={provider} size="xs" />
        {getExternalIssueLabel({label, provider})}
      </InlineChip>
    </ExternalLink>
  );
}
