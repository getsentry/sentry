from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.workflow_engine.registry import workflow_activity_registry


@workflow_activity_registry.register("seer_activity")
def seer_activity_handler(group: Group, activity: Activity) -> None:
    # TODO(Leander): Implement this handler
    pass
