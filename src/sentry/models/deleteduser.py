from __future__ import absolute_import
from django.utils.translation import ugettext_lazy as _
from django.db import models
from sentry.db.models import (
    FlexibleForeignKey, sane_repr, DeletedEntry
)


class DeletedUser(DeletedEntry):
    # In User model this is the convention. Not sure what the library does
    username = models.CharField(_('username'), max_length=128, unique=True)
    name = models.CharField(_('name'), max_length=200, blank=True)
    email = models.EmailField(_('email address'), blank=True)

    organization = FlexibleForeignKey('sentry.Organization')

    # Not certain this is needed?
    team = FlexibleForeignKey('sentry.Team')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_project'
        # Is this needed? not sure?
        unique_together = (('team', 'slug'), ('organization', 'slug'))

    __repr__ = sane_repr('date_deleted', 'team_id', 'name', 'reason')
