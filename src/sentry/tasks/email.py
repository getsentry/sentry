"""
sentry.tasks.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging

from django.core.mail import get_connection

from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


def _get_user_from_email(group, email):
    from sentry.models import Project, User
    # TODO(dcramer): we should encode the userid in emails so we can avoid this

    for user in User.objects.filter(email__iexact=email):
        # Make sure that the user actually has access to this project
        if group.project not in Project.objects.get_for_user(
                team=group.team, user=user):
            logger.warning('User %r does not have access to group %r', user, group)
            continue

        return user


@instrumented_task(
    name='sentry.tasks.email.process_inbound_email',
    queue='email')
def process_inbound_email(mailfrom, group_id, payload):
    """
    """
    from sentry.models import Event, Group
    from sentry.web.forms import NewNoteForm

    try:
        group = Group.objects.select_related('project', 'team').get(pk=group_id)
    except Group.DoesNotExist:
        logger.warning('Group does not exist: %d', group_id)
        return

    user = _get_user_from_email(group, mailfrom)
    if user is None:
        logger.warning('Inbound email from unknown address: %s', mailfrom)
        return

    event = group.get_latest_event() or Event()

    Event.objects.bind_nodes([event], 'data')
    event.group = group
    event.project = group.project

    form = NewNoteForm({'text': payload})
    if form.is_valid():
        form.save(event, user)


@instrumented_task(
    name='sentry.tasks.email.send_email',
    queue='email')
def send_email(message):
    connection = get_connection()
    connection.send_messages([message])
