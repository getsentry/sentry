"""
sentry.models.user
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import warnings

from django.contrib.auth.models import AbstractBaseUser, UserManager
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BaseManager, Model


class UserManager(BaseManager, UserManager):
    pass


class User(Model, AbstractBaseUser):
    username = models.CharField(_('username'), max_length=128, unique=True)
    first_name = models.CharField(_('first name'), max_length=30, blank=True)
    last_name = models.CharField(_('last name'), max_length=30, blank=True)
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

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        return super(User, self).save(*args, **kwargs)

    def has_perm(self, perm_name):
        warnings.warn('User.has_perm is deprecated', DeprecationWarning)
        return self.is_superuser

    def has_module_perms(self, app_label):
        # the admin requires this method
        return self.is_superuser

    def get_full_name(self):
        return self.first_name

    def get_short_name(self):
        return self.username

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry.models import (
            GroupBookmark, Organization, OrganizationMember, ProjectKey, Team,
            UserOption
        )

        for obj in Organization.objects.filter(owner=from_user):
            obj.update(owner=to_user)
        for obj in ProjectKey.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in OrganizationMember.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in Team.objects.filter(owner=from_user):
            obj.update(owner=to_user)
        for obj in GroupBookmark.objects.filter(user=from_user):
            obj.update(user=to_user)
        for obj in UserOption.objects.filter(user=from_user):
            obj.update(user=to_user)

    def get_display_name(self):
        return self.first_name or self.username
