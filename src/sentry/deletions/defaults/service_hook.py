from sentry.deletions.base import ModelDeletionTask
from sentry.sentry_apps.models.servicehook import ServiceHook


class ServiceHookDeletionTask(ModelDeletionTask[ServiceHook]):
    # This subclass just represents an intentional decision to not cascade service hook deletions, and to
    # mark status using ObjectStatus on deletion.  The behavior is identical to the base class
    # so that intentions are clear.
    pass
