from __future__ import absolute_import
from django.db import models
from sentry.db.models import (
    FlexibleForeignKey, sane_repr
)
from sentry.models.deletedentry import DeletedEntry


class DeletedProject(DeletedEntry):
    slug = models.SlugField(null=True)
    name = models.CharField(max_length=200)
    organization = FlexibleForeignKey('sentry.Organization')
    # Not certain this is needed?
    team = FlexibleForeignKey('sentry.Team')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_project'
        # Is this needed? not sure?
        # unique_together = (('team', 'slug'), ('organization', 'slug'))

    __repr__ = sane_repr('date_deleted', 'slug', 'reason')
