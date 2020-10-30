from __future__ import absolute_import, print_function

import logging

from sentry.auth import access
from sentry.tasks.base import instrumented_task
from sentry.utils.email import send_messages

logger = logging.getLogger(__name__)


def _get_user_from_email(group, email):
    from sentry.models import User

    # TODO(dcramer): we should encode the userid in emails so we can avoid this
    for user in User.objects.filter(email__iexact=email):
        # Make sure that the user actually has access to this project
        context = access.from_user(user=user, organization=group.organization)
        if not any(context.has_team(t) for t in group.project.teams.all()):
            logger.warning("User %r does not have access to group %r", user, group)
            continue

        return user


@instrumented_task(
    name="sentry.tasks.email.process_inbound_email",
    queue="email",
    default_retry_delay=60 * 5,
    max_retries=None,
)
def process_inbound_email(mailfrom, group_id, payload):
    """
    """
    from sentry.models import Group
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

    event = group.get_latest_event()

    if event:
        event.group = group
        event.project = group.project

    form = NewNoteForm({"text": payload})
    if form.is_valid():
        form.save(group, user, event=event)


@instrumented_task(
    name="sentry.tasks.email.send_email",
    queue="email",
    default_retry_delay=60 * 5,
    max_retries=None,
)
def send_email(message):
    # HACK(django18) Django 1.8 assumes that message objects have a reply_to attribute
    # When a message is enqueued by django 1.6 we need to patch that property on
    # so that the message can be converted to a stdlib one.
    #
    # See
    # https://github.com/django/django/blob/c686dd8e6bb3817bcf04b8f13c025b4d3c3dc6dc/django/core/mail/message.py#L273-L274
    if not hasattr(message, "reply_to"):
        message.reply_to = []

    send_messages([message])
