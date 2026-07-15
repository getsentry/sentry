import {Link} from '@sentry/scraps/link';

import {InlineChip} from './inlineChip';
import {IssueTrackerIcon} from './issueTrackerIcon';

interface IntegrationChipProps {
  label: string;
  to: string;
}

export function IntegrationChip({label, to}: IntegrationChipProps) {
  return (
    <Link to={to}>
      <InlineChip interactive>
        <IssueTrackerIcon provider={label} size="xs" />
        {label}
      </InlineChip>
    </Link>
  );
}
