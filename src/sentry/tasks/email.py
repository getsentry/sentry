import logging
from typing import Optional

from sentry.auth import access
from sentry.models.group import Group
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.email import send_messages

logger = logging.getLogger(__name__)


def _get_user_from_email(group: Group, email: str) -> Optional[RpcUser]:
    for user in user_service.get_many_by_email(emails=[email]):
        # Make sure that the user actually has access to this project
        context = access.from_user(user=user, organization=group.organization)
        if not any(context.has_team_access(t) for t in group.project.teams.all()):
            logger.warning("User %r does not have access to group %r", user, group)
            continue

        return user
    return None


@instrumented_task(
    name="sentry.tasks.email.process_inbound_email",
    queue="email.inbound",
    default_retry_delay=60 * 5,
    max_retries=None,
    silo_mode=SiloMode.REGION,
)
def process_inbound_email(mailfrom: str, group_id: int, payload: str):
    # TODO(hybridcloud) Once we aren't invoking this with celery
    # detach  this from celery and have a basic function instead.
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


@instrumented_task(
    name="sentry.tasks.email.send_email",
    queue="email",
    default_retry_delay=60 * 5,
    max_retries=None,
    silo_mode=SiloMode.REGION,
)
def send_email(message):
    send_messages([message])


@instrumented_task(
    name="sentry.tasks.email.send_email_control",
    queue="email.control",
    default_retry_delay=60 * 5,
    max_retries=None,
    silo_mode=SiloMode.CONTROL,
)
def send_email_control(message):
    send_messages([message])
