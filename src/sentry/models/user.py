"""
sentry.models.user
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import warnings

from django.contrib.auth.models import AbstractBaseUser, UserManager
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BaseManager, BaseModel, BoundedAutoField


class UserManager(BaseManager, UserManager):
    pass


class User(BaseModel, AbstractBaseUser):
    id = BoundedAutoField(primary_key=True)
    username = models.CharField(_('username'), max_length=128, unique=True)
    # this column is called first_name for legacy reasons, but it is the entire
    # display name
    name = models.CharField(_('name'), max_length=200, blank=True,
                            db_column='first_name')
    email = models.EmailField(_('email address'), blank=True)
    is_staff = models.BooleanField(
        _('staff status'), default=False,
        help_text=_('Designates whether the user can log into this admin '
                    'site.'))
    is_active = models.BooleanField(
        _('active'), default=True,
        help_text=_('Designates whether this user should be treated as '
                    'active. Unselect this instead of deleting accounts.'))
    is_superuser = models.BooleanField(
        _('superuser status'), default=False,
        help_text=_('Designates that this user has all permissions without '
                    'explicitly assigning them.'))
    is_managed = models.BooleanField(
        _('managed'), default=False,
        help_text=_('Designates whether this user should be treated as '
                    'managed. Select this to disallow the user from '
                    'modifying their account (username, password, etc).'))

    date_joined = models.DateTimeField(_('date joined'), default=timezone.now)

    objects = UserManager(cache_fields=['pk'])

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        app_label = 'sentry'
        db_table = 'auth_user'
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def delete(self):
        if self.username == 'sentry':
            raise Exception('You cannot delete the "sentry" user as it is required by Sentry.')
        return super(User, self).delete()

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        return super(User, self).save(*args, **kwargs)

    def has_perm(self, perm_name):
        warnings.warn('User.has_perm is deprecated', DeprecationWarning)
        return self.is_superuser

    def has_module_perms(self, app_label):
        warnings.warn('User.has_module_perms is deprecated', DeprecationWarning)
        return self.is_superuser

    def get_label(self):
        return self.email or self.username or self.id

    def get_display_name(self):
        return self.name or self.email or self.username

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.username

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry.models import (
            AuditLogEntry, Activity, AuthIdentity, GroupBookmark,
            OrganizationMember, UserOption
        )

        for obj in OrganizationMember.objects.filter(user=from_user):
            try:
                with transaction.atomic():
                    obj.update(user=to_user)
            except IntegrityError:
                pass
        for obj in GroupBookmark.objects.filter(user=from_user):
            try:
                with transaction.atomic():
                    obj.update(user=to_user)
            except IntegrityError:
                pass
        for obj in UserOption.objects.filter(user=from_user):
            try:
                with transaction.atomic():
                    obj.update(user=to_user)
            except IntegrityError:
                pass

        Activity.objects.filter(
            user=from_user,
        ).update(user=to_user)
        AuditLogEntry.objects.filter(
            actor=from_user,
        ).update(actor=to_user)
        AuditLogEntry.objects.filter(
            target_user=from_user,
        ).update(target_user=to_user)
        AuthIdentity.objects.filter(
            user=from_user,
        ).update(user=to_user)
