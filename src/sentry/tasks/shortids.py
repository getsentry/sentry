"""
sentry.tasks.shortids
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from contextlib import contextmanager
from celery.utils.log import get_task_logger
from django.db import transaction

from sentry.tasks.base import instrumented_task

logger = get_task_logger(__name__)


class RollbackLocally(Exception):
    pass


@contextmanager
def catchable_atomic():
    try:
        with transaction.atomic():
            yield
    except RollbackLocally:
        pass


@instrumented_task(
    name='sentry.tasks.shortids.fill_missing_project_ids',
    queue='events',
    time_limit=65,
    soft_time_limit=60,
)
def fill_missing_project_ids(project_id=None, **kwargs):
    from sentry.models import Group, Project

    try:
        project = Project.objects.get(pk=int(project_id))
    except Project.DoesNotExist:
        logger.error('Tried to fill missing ids of non existing project %s',
                     project_id)
        return

    q = Group.objects.filter(
        project=project,
        short_id=None,
    )

    for group in q.iterator():
        with catchable_atomic():
            pending_short_id = project.next_short_id()
            updated = Group.objects.filter(
                pk=group.id,
                short_id=None
            ).update(short_id=pending_short_id)
            if updated == 0:
                raise RollbackLocally()


@instrumented_task(
    name='sentry.tasks.shortids.fill_missing_organization_ids',
    queue='events',
    time_limit=65,
    soft_time_limit=60,
)
def fill_missing_organization_ids(organization_id=None, **kwargs):
    from sentry.models import Organization

    try:
        org = Organization.objects.get(pk=int(organization_id))
    except Organization.DoesNotExist:
        logger.error('Tried to fill missing ids of non existing organization %s',
                     organization_id)
        return

    for project in org.project_set.all():
        fill_missing_project_ids.delay(project_id=project.id)
