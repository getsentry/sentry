from ..base import ModelDeletionTask


class PlatformExternalIssueDeletionTask(ModelDeletionTask):
    def mark_deletion_in_progress(self, instance_list):
        # No status to track this.
        pass
