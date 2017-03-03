"""
sentry.models.groupassignee
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr, \
    BaseManager
from sentry.models.activity import Activity


class GroupAssigneeManager(BaseManager):

    def assign(self, group, assigned_to, acting_user=None):
        now = timezone.now()
        assignee, created = GroupAssignee.objects.get_or_create(
            group=group,
            defaults={
                'project': group.project,
                'user': assigned_to,
                'date_added': now,
            }
        )

        if not created:
            affected = GroupAssignee.objects.filter(
                group=group,
            ).exclude(
                user=assigned_to,
            ).update(
                user=assigned_to,
                date_added=now
            )
        else:
            affected = True

        if affected:
            activity = Activity.objects.create(
                project=group.project,
                group=group,
                type=Activity.ASSIGNED,
                user=acting_user,
                data={
                    'assignee': six.text_type(assigned_to.id),
                    'assigneeEmail': assigned_to.email,
                }
            )
            activity.send_notification()

    def deassign(self, group, acting_user=None):
        affected = GroupAssignee.objects.filter(
            group=group,
        )[:1].count()
        GroupAssignee.objects.filter(
            group=group,
        ).delete()

        if affected > 0:
            activity = Activity.objects.create(
                project=group.project,
                group=group,
                type=Activity.UNASSIGNED,
                user=acting_user,
            )
            activity.send_notification()


class GroupAssignee(Model):
    """
    Identifies an assignment relationship between a user and an
    aggregated event (Group).
    """
    __core__ = False

    objects = GroupAssigneeManager()

    project = FlexibleForeignKey('sentry.Project', related_name="assignee_set")
    group = FlexibleForeignKey('sentry.Group', related_name="assignee_set", unique=True)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="sentry_assignee_set")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupasignee'

    __repr__ = sane_repr('group_id', 'user_id')
