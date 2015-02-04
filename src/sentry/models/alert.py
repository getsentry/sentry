"""
sentry.models.alert
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from datetime import timedelta
from django.core.urlresolvers import reverse
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    FlexibleForeignKey, Model, GzippedDictField, BoundedPositiveIntegerField,
    sane_repr
)
from sentry.utils.http import absolute_uri


class AlertStatus(object):
    UNRESOLVED = 0
    RESOLVED = 1


class Alert(Model):
    project = FlexibleForeignKey('sentry.Project')
    group = FlexibleForeignKey('sentry.Group', null=True)
    datetime = models.DateTimeField(default=timezone.now)
    message = models.TextField()
    data = GzippedDictField(null=True)
    related_groups = models.ManyToManyField('sentry.Group', through='sentry.AlertRelatedGroup', related_name='related_alerts')
    status = BoundedPositiveIntegerField(default=0, choices=(
        (AlertStatus.UNRESOLVED, _('Unresolved')),
        (AlertStatus.RESOLVED, _('Resolved')),
    ), db_index=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_alert'

    __repr__ = sane_repr('project_id', 'group_id', 'datetime')

    # TODO: move classmethods to manager
    @classmethod
    def get_recent_for_project(cls, project_id):
        return cls.objects.filter(
            project=project_id,
            group_id__isnull=True,
            datetime__gte=timezone.now() - timedelta(minutes=60),
            status=AlertStatus.UNRESOLVED,
        ).order_by('-datetime')

    @classmethod
    def maybe_alert(cls, project_id, message, group_id=None):
        now = timezone.now()
        manager = cls.objects
        # We only create an alert based on:
        # - an alert for the project hasn't been created in the last 30 minutes
        # - an alert for the event hasn't been created in the last 60 minutes

        # TODO: there is a race condition if we're calling this function for the same project
        kwargs = {
            'project_id': project_id,
            'datetime__gte': now - timedelta(minutes=60),
        }
        if group_id:
            kwargs['group'] = group_id

        if manager.filter(**kwargs).exists():
            return

        alert = manager.create(
            project_id=project_id,
            group_id=group_id,
            datetime=now,
            message=message,
        )

        return alert

    @property
    def team(self):
        return self.project.team

    @property
    def organization(self):
        return self.project.organization

    @property
    def is_resolved(self):
        return (self.status == AlertStatus.RESOLVED
                or self.datetime < timezone.now() - timedelta(minutes=60))

    def get_absolute_url(self):
        return absolute_uri(reverse('sentry-alert-details', args=[
            self.organization.slug, self.project.slug, self.id]))


class AlertRelatedGroup(Model):
    group = FlexibleForeignKey('sentry.Group')
    alert = FlexibleForeignKey(Alert)
    data = GzippedDictField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_alertrelatedgroup'
        unique_together = (('group', 'alert'),)

    __repr__ = sane_repr('group_id', 'alert_id')
