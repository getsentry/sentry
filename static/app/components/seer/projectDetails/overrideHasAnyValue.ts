import type {SeerProjectReposResponse} from 'sentry/utils/seer/types';

export function overrideHasAnyValue(
  override: SeerProjectReposResponse['branchOverrides'][number]
) {
  return (
    override.tagName.trim() || override.tagValue.trim() || override.branchName.trim()
  );
}
