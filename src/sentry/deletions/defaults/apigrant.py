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
