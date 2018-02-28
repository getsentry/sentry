from __future__ import absolute_import

from jsonfield import JSONField

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey
from sentry.ownership.grammar import dump_schema, parse_rules


class ProjectOwnership(Model):
    __core__ = True

    project = FlexibleForeignKey('sentry.Project', unique=True)
    raw = models.TextField(null=True)
    schema = JSONField(null=True)
    fallthrough = models.BooleanField(default=True)
    date_created = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectownership'

    __repr__ = sane_repr('project_id', 'is_active')

    def save(self, *args, **kwargs):
        if self.raw is None:
            self.schema = None
        else:
            self.schema = dump_schema(parse_rules(self.raw))
        return super(ProjectOwnership, self).save(*args, **kwargs)
