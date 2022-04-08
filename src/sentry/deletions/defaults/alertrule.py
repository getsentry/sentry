from ..base import ModelDeletionTask


class AlertRuleDeletionTask(ModelDeletionTask):
    # The default manager for alert rules excludes snapshots
    # which we want to include when deleting an organization.
    manager_name = "objects_with_snapshots"
