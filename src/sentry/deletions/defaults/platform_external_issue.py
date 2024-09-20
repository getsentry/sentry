from collections.abc import Sequence

from sentry.deletions.base import ModelDeletionTask
from sentry.models.platformexternalissue import PlatformExternalIssue


class PlatformExternalIssueDeletionTask(ModelDeletionTask[PlatformExternalIssue]):
    def mark_deletion_in_progress(self, instance_list: Sequence[PlatformExternalIssue]) -> None:
        # No status to track this.
        pass
