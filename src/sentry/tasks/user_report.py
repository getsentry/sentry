from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute


@instrumented_task(name="sentry.tasks.user_report")
def user_report(report, project_id):
    """
    Create and send a UserReport.

    :param report: Serialized `UserReport` object from the DB
    :param project_id: The user's project's ID
    """
    from sentry.mail import mail_adapter
    from sentry.models import Project

    project = Project.objects.get_from_cache(id=project_id)
    safe_execute(mail_adapter.handle_user_report, report=report, project=project)
