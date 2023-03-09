from ..base import ModelDeletionTask


class ServiceHookDeletionTask(ModelDeletionTask):
    # This subclass just represents an intentional decision to not cascade service hook deletions, and to
    # mark status using ObjectStatus on deletion.  The behavior is identical to the base class the task is explicit
    # so that it is a clear intention.
    pass
