from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model,
    BoundedPositiveIntegerField,
    UUIDField,
    sane_repr,
)


class BuildStatus(object):
    NEEDS_APPROVED = 1
    APPROVED = 2

    @classmethod
    def as_choices(cls):
        return (
            (cls.NEEDS_APPROVED, 'needs_approved'),
            (cls.APPROVED, 'approved'),
        )


class Build(Model):
    __core__ = True

    guid = UUIDField(unique=True, auto_add=True)
    organization_id = BoundedPositiveIntegerField(db_index=True)
    project_id = BoundedPositiveIntegerField(db_index=True)
    build_id = models.TextField()
    build_id_hash = models.CharField(max_length=128)
    name = models.TextField(null=True)
    status = BoundedPositiveIntegerField(
        default=BuildStatus.NEEDS_APPROVED,
        choices=BuildStatus.as_choices(),
    )
    new_issues = BoundedPositiveIntegerField(default=0)
    total_issues = BoundedPositiveIntegerField(default=0)
    total_events = BoundedPositiveIntegerField(default=0)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_build'
        unique_together = (('project_id', 'build_id_hash'),)

    __repr__ = sane_repr('guid', 'project_id')
