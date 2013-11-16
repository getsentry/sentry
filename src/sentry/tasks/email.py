"""
sentry.tasks.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import logging
from celery.task import task

logger = logging.getLogger(__name__)


@task(name='sentry.tasks.email.process_inbound_email', queue='email')
def process_inbound_email(mailfrom, group_id, payload):
    """
    """
    from django.contrib.auth.models import User
    from sentry.models import Event, Group, Project
    from sentry.web.forms import NewNoteForm

    try:
        user = User.objects.get(email__iexact=mailfrom)
    except User.DoesNotExist:
        logger.warning('Inbound email from unknown address: %s', mailfrom)
        return
    except User.MultipleObjectsReturned:
        logger.warning('Inbound email address matches multiple accounts: %s', mailfrom)
        return

    try:
        group = Group.objects.select_related('project', 'team').get(pk=group_id)
    except Group.DoesNotExist:
        logger.warning('Group does not exist: %d', group_id)
        return

    # Make sure that the user actually has access to this project
    if group.project not in Project.objects.get_for_user(
            user, team=group.team, superuser=False):
        logger.warning('User %r does not have access to group %r', (user, group))
        return

    event = group.get_latest_event() or Event()

    Event.objects.bind_nodes([event], 'data')
    event.group = group
    event.project = group.project

    form = NewNoteForm({'text': payload})
    if form.is_valid():
        form.save(event, user)
