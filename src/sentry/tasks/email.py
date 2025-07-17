import logging
from smtplib import SMTPDataError
from typing import Any

from sentry.auth import access
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import notifications_control_tasks, notifications_tasks
from sentry.taskworker.retry import Retry
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.email import send_messages
from sentry.utils.email.message_builder import message_from_dict

logger = logging.getLogger(__name__)


def _get_user_from_email(group: Group, email: str) -> RpcUser | None:
    for user in user_service.get_many_by_email(emails=[email]):
        # Make sure that the user actually has access to this project
        context = access.from_user(user=user, organization=group.organization)
        if not any(context.has_team_access(t) for t in group.project.teams.all()):
            logger.warning("User %r does not have access to group %r", user, group)
            continue

        return user
    return None


def process_inbound_email(mailfrom: str, group_id: int, payload: str) -> None:
    from sentry.models.group import Group
    from sentry.web.forms import NewNoteForm

    try:
        group = Group.objects.select_related("project").get(pk=group_id)
    except Group.DoesNotExist:
        logger.warning("Group does not exist: %d", group_id)
        return

    user = _get_user_from_email(group, mailfrom)
    if user is None:
        logger.warning("Inbound email from unknown address: %s", mailfrom)
        return

    form = NewNoteForm({"text": payload})
    if form.is_valid():
        form.save(group, user)


class TemporaryEmailError(Exception):
    """
    SMTPDataError with a 4xx code, and thus is temporary and retriable.
    """

    def __init__(self, code: int, msg: str | bytes) -> None:
        self.smtp_code = code
        self.smtp_error = msg
        self.args = (code, msg)


def _send_email(message: dict[str, Any]) -> None:
    try:
        send_messages([message_from_dict(message)])
    except SMTPDataError as e:
        # 4xx means temporary and retriable; See RFC 5321, §4.2.1
        if 400 <= e.smtp_code < 500:
            raise TemporaryEmailError(e.smtp_code, e.smtp_error)
        raise


@instrumented_task(
    name="sentry.tasks.email.send_email",
    queue="email",
    default_retry_delay=60 * 5,
    max_retries=None,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=notifications_tasks,
        processing_deadline_duration=30,
        retry=Retry(
            times=2,
            delay=60 * 5,
        ),
    ),
)
@retry(on=(TemporaryEmailError,))
def send_email(message: dict[str, Any]) -> None:
    _send_email(message)


@instrumented_task(
    name="sentry.tasks.email.send_email_control",
    queue="email.control",
    default_retry_delay=60 * 5,
    max_retries=None,
    silo_mode=SiloMode.CONTROL,
    taskworker_config=TaskworkerConfig(
        namespace=notifications_control_tasks,
        processing_deadline_duration=30,
        retry=Retry(
            times=2,
            delay=60 * 5,
        ),
    ),
)
@retry(on=(TemporaryEmailError,))
def send_email_control(message: dict[str, Any]) -> None:
    _send_email(message)
