from __future__ import annotations

import enum
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.utils.http import absolute_uri
from sentry.utils.security import get_secure_token

if TYPE_CHECKING:
    from sentry.models import User


class LostPasswordHashType(enum.Enum):
    RECOVER = "recover_account"
    SET_PASSWORD = "set_password"


URL_KEYS = {
    LostPasswordHashType.RECOVER: "sentry-account-recover-confirm",
    LostPasswordHashType.SET_PASSWORD: "sentry-account-set-password-confirm",
}


class LostPasswordHashManager(BaseManager):
    def for_user(self, user: User) -> LostPasswordHash:
        """
        NOTE(mattrobenolt): Some security people suggest we invalidate existing
        password hashes, but this opens up the possibility of a DoS vector where
        then password resets are continually requested, thus preventing someone
        from actually resetting their password.

        See: https://github.com/getsentry/sentry/pull/17299
        """
        password_hash, _ = self.get_or_create(user=user)
        if not password_hash.is_valid():
            password_hash.date_added = timezone.now()
            password_hash.set_hash()
            password_hash.save()

        return password_hash


class LostPasswordHash(Model):
    __include_in_export__ = False

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, unique=True)
    hash = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    objects = LostPasswordHashManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_lostpasswordhash"

    __repr__ = sane_repr("user_id", "hash")

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.hash:
            self.set_hash()
        super().save(*args, **kwargs)

    def set_hash(self) -> None:
        self.hash = get_secure_token()

    def is_valid(self) -> bool:
        return self.date_added > timezone.now() - timedelta(hours=48)

    def get_absolute_url(self, mode: LostPasswordHashType = LostPasswordHashType.RECOVER) -> str:
        return absolute_uri(reverse(URL_KEYS[mode], args=[self.user.id, self.hash]))
