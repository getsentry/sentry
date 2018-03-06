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
from sentry.signals import issue_assigned


class GroupAssigneeManager(BaseManager):
    def assign(self, group, assigned_to, acting_user=None):
        from sentry.models import User, Team, GroupSubscription, GroupSubscriptionReason

        GroupSubscription.objects.subscribe_actor(
            group=group,
            actor=assigned_to,
            reason=GroupSubscriptionReason.assigned,
        )

        if isinstance(assigned_to, User):
            assignee_type = 'user'
            other_type = 'team'
        elif isinstance(assigned_to, Team):
            assignee_type = 'team'
            other_type = 'user'
        else:
            raise AssertionError('Invalid type to assign to: %r' % type(assigned_to))

        now = timezone.now()
        assignee, created = GroupAssignee.objects.get_or_create(
            group=group,
            defaults={
                'project': group.project,
                assignee_type: assigned_to,
                'date_added': now,
            }
        )

        if not created:
            affected = GroupAssignee.objects.filter(
                group=group,
            ).exclude(**{
                assignee_type: assigned_to,
            }).update(**{
                assignee_type: assigned_to,
                other_type: None,
                'date_added': now,
            })
        else:
            affected = True
            issue_assigned.send(project=group.project, group=group, sender=acting_user)

        if affected:
            activity = Activity.objects.create(
                project=group.project,
                group=group,
                type=Activity.ASSIGNED,
                user=acting_user,
                data={
                    'assignee': six.text_type(assigned_to.id),
                    'assigneeEmail': getattr(assigned_to, 'email', None),
                    'assigneeType': assignee_type,
                },
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
    Identifies an assignment relationship between a user/team and an
    aggregated event (Group).
    """
    __core__ = False

    objects = GroupAssigneeManager()

    project = FlexibleForeignKey('sentry.Project', related_name="assignee_set")
    group = FlexibleForeignKey('sentry.Group', related_name="assignee_set", unique=True)
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sentry_assignee_set",
        null=True)
    team = FlexibleForeignKey(
        'sentry.Team',
        related_name="sentry_assignee_set",
        null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupasignee'

    __repr__ = sane_repr('group_id', 'user_id', 'team_id')

    def save(self, *args, **kwargs):
        assert (
            not (self.user_id is not None and self.team_id is not None) and
            not (self.user_id is None and self.team_id is None)
        ), 'Must have Team or User, not both'
        super(GroupAssignee, self).save(*args, **kwargs)

    def assigned_actor_id(self):
        if self.user:
            return u"user:{}".format(self.user_id)

        if self.team:
            return u"team:{}".format(self.team_id)

        raise NotImplementedError("Unkown Assignee")

    def assigned_actor(self):
        from sentry.api.fields.actor import Actor

        return Actor.from_actor_id(self.assigned_actor_id())
