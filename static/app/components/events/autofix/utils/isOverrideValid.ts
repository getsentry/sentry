import type {SeerProjectRepoBranchOverrideInput} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';

export function isOverrideValid(override: SeerProjectRepoBranchOverrideInput) {
  return (
    override.branchName.trim() !== '' &&
    override.tagName.trim() !== '' &&
    override.tagValue.trim() !== ''
  );
}
