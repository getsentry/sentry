from collections import defaultdict
from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.manager import BaseManager

if TYPE_CHECKING:
    from sentry.models import User

CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


class UserEmailManager(BaseManager):
    def get_for_organization(self, organization):
        return self.filter(user__sentry_orgmember_set__organization=organization)

    def get_emails_by_user(self, organization):
        emails_by_user = defaultdict(set)
        user_emails = self.get_for_organization(organization).select_related("user")
        for entry in user_emails:
            emails_by_user[entry.user].add(entry.email)
        return emails_by_user

    def get_primary_email(self, user: "User") -> "UserEmail":
        user_email, _ = self.get_or_create(user=user, email=user.email)
        return user_email


def default_validation_hash():
    return get_random_string(32, CHARACTERS)


class UserEmail(Model):
    __include_in_export__ = True

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, related_name="emails")
    email = models.EmailField(_("email address"), max_length=75)
    validation_hash = models.CharField(max_length=32, default=default_validation_hash)
    date_hash_added = models.DateTimeField(default=timezone.now)
    is_verified = models.BooleanField(
        _("verified"),
        default=False,
        help_text=_("Designates whether this user has confirmed their email."),
    )
    objects = UserEmailManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useremail"
        unique_together = (("user", "email"),)

    __repr__ = sane_repr("user_id", "email")

    def set_hash(self):
        self.date_hash_added = timezone.now()
        self.validation_hash = default_validation_hash()

    def hash_is_valid(self):
        return self.validation_hash and self.date_hash_added > timezone.now() - timedelta(hours=48)

    def is_primary(self):
        return self.user.email == self.email

    @classmethod
    def get_primary_email(cls, user: "User") -> "UserEmail":
        """@deprecated"""
        return cls.objects.get_primary_email(user)
