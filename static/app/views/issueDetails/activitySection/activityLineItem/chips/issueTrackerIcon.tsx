import {IconIssues, IconJira, IconLinear} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface IssueTrackerIconProps extends SVGIconProps {
  provider: string;
}

export function IssueTrackerIcon({provider, ...props}: IssueTrackerIconProps) {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider.includes('linear')) {
    return <IconLinear {...props} />;
  }

  if (normalizedProvider.includes('jira')) {
    return <IconJira {...props} />;
  }

  return <IconIssues {...props} />;
}
