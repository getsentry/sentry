from collections.abc import Mapping
from typing import int, Any

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils.safe import safe_execute


@instrumented_task(
    name="sentry.tasks.user_report",
    namespace=issues_tasks,
    silo_mode=SiloMode.REGION,
)
def user_report(
    project_id: int, report: Mapping[str, Any] | None = None, report_id: int | None = None, **kwargs
):
    """
    Create and send a UserReport.

    :param report: Serialized `UserReport` object from the DB
    :param project_id: The user's project's ID
    """
    from django.contrib.auth.models import AnonymousUser

    from sentry.api.serializers import UserReportWithGroupSerializer, serialize
    from sentry.mail import mail_adapter
    from sentry.models.project import Project
    from sentry.models.userreport import UserReport

    project = Project.objects.get_from_cache(id=project_id)
    if report_id:
        user_report = UserReport.objects.get(id=report_id)
        user_report = serialize(user_report, AnonymousUser(), UserReportWithGroupSerializer())
        safe_execute(mail_adapter.handle_user_report, report=user_report, project=project)
    else:
        safe_execute(mail_adapter.handle_user_report, report=report, project=project)
