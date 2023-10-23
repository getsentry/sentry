from django.db import router

from sentry.models.apigrant import ApiGrant
from sentry.silo.safety import unguarded_write

from ..base import ModelDeletionTask


class ModelApiGrantDeletionTask(ModelDeletionTask):
    """
    Normally ApiGrants are deleted in bulk, but for cascades originating from sentry app installation, we wish to use
    the orm so that set null behavior functions correctly.  Do not register this as the default, but instead use it as
    the task= parameter to a relation.
    """

    def mark_deletion_in_progress(self, instance_list):
        # no status to track
        pass

    def delete_instance(self, instance):
        with unguarded_write(router.db_for_write(ApiGrant)):
            super().delete_instance(instance)
