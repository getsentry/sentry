"""
sentry.models.user
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import warnings

from django.contrib.auth.models import AbstractBaseUser, UserManager
from django.core.urlresolvers import reverse
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import BaseManager, BaseModel, BoundedAutoField
from sentry.utils.http import absolute_uri


class UserManager(BaseManager, UserManager):
    pass


class User(BaseModel, AbstractBaseUser):
    __core__ = True

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
    is_password_expired = models.BooleanField(
        _('password expired'), default=False,
        help_text=_('If set to true then the user needs to change the '
                    'password on next sign in.'))
    last_password_change = models.DateTimeField(
        _('date of last password change'), null=True,
        help_text=_('The date the password was changed last.'))

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
        avatar = self.avatar.first()
        if avatar:
            avatar.delete()
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

    def has_unverified_emails(self):
        return self.emails.filter(is_verified=False).exists()

    def get_label(self):
        return self.email or self.username or self.id

    def get_display_name(self):
        return self.name or self.email or self.username

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.username

    def get_avatar_type(self):
        avatar = self.avatar.first()
        if avatar:
            return avatar.get_avatar_type_display()
        return 'letter_avatar'

    def send_confirm_emails(self, is_new_user=False):
        from sentry import options
        from sentry.utils.email import MessageBuilder

        for email in self.emails.filter(is_verified=False):
            if not email.hash_is_valid():
                email.set_hash()
                email.save()

            context = {
                'user': self,
                'url': absolute_uri(reverse(
                    'sentry-account-confirm-email',
                    args=[self.id, email.validation_hash]
                )),
                'confirm_email': email.email,
                'is_new_user': is_new_user,
            }
            msg = MessageBuilder(
                subject='%sConfirm Email' % (options.get('mail.subject-prefix'),),
                template='sentry/emails/confirm_email.txt',
                html_template='sentry/emails/confirm_email.html',
                type='user.confirm_email',
                context=context,
            )
            msg.send_async([email.email])

    def merge_to(from_user, to_user):
        # TODO: we could discover relations automatically and make this useful
        from sentry import roles
        from sentry.models import (
            AuditLogEntry, Activity, AuthIdentity, GroupAssignee, GroupBookmark,
            GroupSeen, OrganizationMember, OrganizationMemberTeam, UserAvatar,
            UserOption
        )

        for obj in OrganizationMember.objects.filter(user=from_user):
            try:
                with transaction.atomic():
                    obj.update(user=to_user)
            except IntegrityError:
                pass

            # identify the highest priority membership
            to_member = OrganizationMember.objects.get(
                organization=obj.organization_id,
                user=to_user,
            )
            if roles.get(obj.role).priority > roles.get(to_member.role).priority:
                to_member.update(role=obj.role)

            for team in obj.teams.all():
                try:
                    with transaction.atomic():
                        OrganizationMemberTeam.objects.create(
                            organizationmember=to_member,
                            team=team,
                        )
                except IntegrityError:
                    pass

        model_list = (
            GroupAssignee,
            GroupBookmark,
            GroupSeen,
            UserAvatar,
            UserOption
        )

        for model in model_list:
            for obj in model.objects.filter(user=from_user):
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

        # remove any duplicate identities that exist on the current user that
        # might conflict w/ the new users existing SSO
        AuthIdentity.objects.filter(
            user=from_user,
            auth_provider__organization__in=AuthIdentity.objects.filter(
                user=to_user,
            ).values('auth_provider__organization')
        ).delete()
        AuthIdentity.objects.filter(
            user=from_user,
        ).update(user=to_user)

    def set_password(self, raw_password):
        super(User, self).set_password(raw_password)
        self.last_password_change = timezone.now()
        self.is_password_expired = False
