import type {BranchOverride} from 'sentry/components/events/autofix/types';

export function overrideHasAnyValue(override: BranchOverride) {
  return (
    override.tag_name.trim() || override.tag_value.trim() || override.branch_name.trim()
  );
}
