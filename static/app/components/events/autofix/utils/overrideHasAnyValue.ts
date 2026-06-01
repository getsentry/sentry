import type {SeerProjectRepoBranchOverrideInput} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';

export function overrideHasAnyValue(override: SeerProjectRepoBranchOverrideInput) {
  return (
    override.tagName.trim() || override.tagValue.trim() || override.branchName.trim()
  );
}
