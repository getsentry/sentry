from __future__ import absolute_import
from django.utils.translation import ugettext_lazy as _
from django.db import models
from sentry.db.models import (
    sane_repr, BoundedBigIntegerField
)
from sentry.models.deletedentry import DeletedEntry


class DeletedUser(DeletedEntry):
    # In User model this is the convention. Not sure what the library does
    username = models.CharField(_('username'), max_length=128, unique=True)
    name = models.CharField(_('name'), max_length=200, blank=True)
    email = models.EmailField(_('email address'), blank=True)

    organization_id = BoundedBigIntegerField(null=True, blank=True)
    organization_name = models.CharField(max_length=64)
    organization_slug = models.SlugField(null=True)

    team_id = BoundedBigIntegerField(null=True, blank=True)
    team_name = models.CharField(max_length=64)
    team_slug = models.SlugField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deleteduser'

    __repr__ = sane_repr('date_deleted', 'team_id', 'name', 'reason')
