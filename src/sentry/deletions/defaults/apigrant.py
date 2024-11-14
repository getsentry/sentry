from collections.abc import Sequence

from django.db import router

from sentry.deletions.base import ModelDeletionTask
from sentry.models.apigrant import ApiGrant
from sentry.silo.safety import unguarded_write


class ModelApiGrantDeletionTask(ModelDeletionTask[ApiGrant]):
    """
    Normally ApiGrants are deleted in bulk, but for cascades originating from sentry app installation, we wish to use
    the orm so that set null behavior functions correctly.  Do not register this as the default, but instead use it as
    the task= parameter to a relation.
    """

    def mark_deletion_in_progress(self, instance_list: Sequence[ApiGrant]) -> None:
        # no status to track
        pass

    def delete_instance(self, instance: ApiGrant) -> None:
        with unguarded_write(router.db_for_write(ApiGrant)):
            super().delete_instance(instance)
