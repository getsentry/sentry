import type {Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';

export default function getRepoStatusLabel(repo: Repository) {
  switch (repo.status) {
    case RepositoryStatus.PENDING_DELETION:
      return 'Deletion Queued';
    case RepositoryStatus.DELETION_IN_PROGRESS:
      return 'Deletion in Progress';
    case RepositoryStatus.DISABLED:
      return 'Disabled';
    case RepositoryStatus.HIDDEN:
      return 'Disabled';
    default:
      return null;
  }
}
