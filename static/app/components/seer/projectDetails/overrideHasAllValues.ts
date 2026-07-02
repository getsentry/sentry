import type {SeerProjectReposResponse} from 'sentry/utils/seer/types';

export function overrideHasAllValues(
  override: SeerProjectReposResponse['branchOverrides'][number]
) {
  return (
    override.branchName.trim() !== '' &&
    override.tagName.trim() !== '' &&
    override.tagValue.trim() !== ''
  );
}
