from __future__ import absolute_import
from django.utils.translation import ugettext_lazy as _
from django.db import models
from sentry.db.models import (
    sane_repr
)
from django.utils import timezone
from sentry.models.deletedentry import DeletedEntry


class DeletedUser(DeletedEntry):
    # In User model this is the convention. Not sure what the library does
    username = models.CharField(_('username'), max_length=128, unique=True)
    name = models.CharField(_('name'), max_length=200, blank=True)
    email = models.EmailField(_('email address'), blank=True)

    is_staff = is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Designates whether the user can log into this admin '
                    'site.')
    )
    is_superuser = models.BooleanField(
        _('superuser status'),
        default=False,
        help_text=_(
            'Designates that this user has all permissions without '
            'explicitly assigning them.'
        )
    )
    last_active = models.DateTimeField(_('last active'), default=timezone.now, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_deleteduser'

    __repr__ = sane_repr('date_deleted', 'team_id', 'name', 'reason')
