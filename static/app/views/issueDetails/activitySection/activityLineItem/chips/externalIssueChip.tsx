import {ExternalLink} from '@sentry/scraps/link';

import {IconIssues, IconJira, IconLinear} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {InlineChip} from './inlineChip';

interface ExternalIssueChipProps {
  label: string;
  location: string;
  provider: string;
}

function getExternalIssueIcon(provider: string): React.ComponentType<SVGIconProps> {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider.includes('linear')) {
    return IconLinear;
  }

  if (normalizedProvider.includes('jira')) {
    return IconJira;
  }

  return IconIssues;
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
  const Icon = getExternalIssueIcon(provider);

  return (
    <ExternalLink href={location}>
      <InlineChip interactive tone="accent">
        <Icon size="xs" />
        {getExternalIssueLabel({label, provider})}
      </InlineChip>
    </ExternalLink>
  );
}
