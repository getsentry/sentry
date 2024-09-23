from collections.abc import Sequence

from sentry.deletions.base import ModelDeletionTask
from sentry.models.apitoken import ApiToken


class ModelApiTokenDeletionTask(ModelDeletionTask[ApiToken]):
    """
    Normally ApiTokens are deleted in bulk, but for cascades originating from sentry app installation, we wish to use
    the orm so that set null behavior functions correctly.  Do not register this as the default, but instead use it as
    the task= parameter to a relation.
    """

    def mark_deletion_in_progress(self, instance_list: Sequence[ApiToken]) -> None:
        # no status to track
        pass
