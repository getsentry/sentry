import type {BranchOverride} from 'sentry/components/events/autofix/types';

export function isOverrideValid(override: BranchOverride) {
  return (
    override.branch_name.trim() !== '' &&
    override.tag_name.trim() !== '' &&
    override.tag_value.trim() !== ''
  );
}
