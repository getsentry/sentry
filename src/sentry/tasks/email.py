import hashlib
import logging
from smtplib import SMTPDataError
from typing import Any

from django.core.cache import cache
from taskbroker_client.retry import Retry

from sentry import options
from sentry.auth import access
from sentry.issues.action_log import ActionSource
from sentry.issues.comments import create_comment
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import notifications_control_tasks, notifications_tasks
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
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
    try:
        group = Group.objects.select_related("project").get(pk=group_id)
    except Group.DoesNotExist:
        logger.warning("Group does not exist: %d", group_id)
        return

    user = _get_user_from_email(group, mailfrom)
    if user is None:
        logger.warning("Inbound email from unknown address: %s", mailfrom)
        return

    text = payload.strip()
    if not text or "\x00" in text:
        return

    # Email redelivery deduplicates without the API's one-hour window.
    create_comment(
        group=group, user=user, data={"text": text}, source=ActionSource.EMAIL, from_email=True
    )


class TemporaryEmailError(Exception):
    """
    SMTPDataError with a 4xx code, and thus is temporary and retriable.
    """

    def __init__(self, code: int, msg: str | bytes) -> None:
        self.smtp_code = code
        self.smtp_error = msg
        self.args = (code, msg)


class EmailSendInProgress(Exception):
    """
    Another delivery of the same message holds the send claim. Retrying later,
    instead of skipping, keeps the email from being lost if that send fails.
    """


SEND_CLAIM_TIMEOUT = 90
SENT_MARKER_TIMEOUT = 60 * 60 * 24
_SENDING = "sending"
_SENT = "sent"


def _dedupe_key(message_id: str) -> str:
    digest = hashlib.sha256(message_id.encode()).hexdigest()
    return f"mail:send-dedupe:{digest}"


def _record_dedupe(result: str) -> None:
    metrics.incr("email.send_dedupe", tags={"result": result}, sample_rate=1.0)


def _claim_send(key: str) -> bool:
    """
    Returns True when this delivery should send. Cache failures fail open:
    a possible duplicate is better than a dropped email.
    """
    try:
        if cache.add(key, _SENDING, SEND_CLAIM_TIMEOUT):
            return True
        state = cache.get(key)
    except Exception:
        logger.warning("mail.send_dedupe.cache_error", exc_info=True)
        _record_dedupe("cache_error")
        return True

    if state == _SENT:
        _record_dedupe("duplicate")
        return False
    # another copy is mid-send, or released its claim after our add()
    _record_dedupe("in_progress")
    raise EmailSendInProgress()


def _set_dedupe_state(key: str, sent: bool) -> None:
    try:
        if sent:
            cache.set(key, _SENT, SENT_MARKER_TIMEOUT)
        else:
            cache.delete(key)
    except Exception:
        logger.warning("mail.send_dedupe.cache_error", exc_info=True)
        _record_dedupe("cache_error")


def _send_email_once(message: dict[str, Any]) -> None:
    if not options.get("mail.send-dedupe.enabled"):
        _send_email(message)
        return

    message_id = (message.get("headers") or {}).get("Message-Id")
    if not message_id:
        logger.error("mail.send_dedupe.missing_message_id")
        _send_email(message)
        return

    key = _dedupe_key(message_id)
    if not _claim_send(key):
        logger.info("mail.send_dedupe.duplicate_skipped", extra={"message_id": message_id})
        return

    try:
        _send_email(message)
    except BaseException:
        # catches ProcessingDeadlineExceeded
        _set_dedupe_state(key, sent=False)
        raise
    _set_dedupe_state(key, sent=True)
    _record_dedupe("sent")


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
    namespace=notifications_tasks,
    processing_deadline_duration=SEND_CLAIM_TIMEOUT,
    retry=Retry(times=2, delay=60 * 5, on=(TemporaryEmailError, EmailSendInProgress)),
    silo_mode=SiloMode.CELL,
)
def send_email(message: dict[str, Any]) -> None:
    _send_email_once(message)


@instrumented_task(
    name="sentry.tasks.email.send_email_control",
    namespace=notifications_control_tasks,
    processing_deadline_duration=90,
    retry=Retry(times=2, delay=60 * 5, on=(TemporaryEmailError,)),
    silo_mode=SiloMode.CONTROL,
)
def send_email_control(message: dict[str, Any]) -> None:
    _send_email(message)
