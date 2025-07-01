import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

TOKEN_MINUTES_VALID = 30


def generate_token() -> str:
    return secrets.token_hex(nbytes=32)


def generate_expires_at() -> datetime:
    return timezone.now() + timedelta(minutes=TOKEN_MINUTES_VALID)


@control_silo_model
class UserMergeVerificationCode(DefaultFieldsModel):
    """
    A temporary model used to store verification codes for users who are manually
    merging their accounts with the same primary email address. We will remove this
    table after the work around merging users with the same primary email is complete.
    """

    __relocation_scope__ = RelocationScope.Excluded

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, unique=True)
    token = models.CharField(max_length=64, default=generate_token)
    expires_at = models.DateTimeField(default=generate_expires_at)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_user_verification_codes_temp"

    __repr__ = sane_repr("user_id", "token")

    def regenerate_token(self) -> None:
        self.token = generate_token()
        self.refresh_expires_at()

    def refresh_expires_at(self) -> None:
        now = timezone.now()
        self.expires_at = now + timedelta(minutes=TOKEN_MINUTES_VALID)

    def is_valid(self) -> bool:
        return timezone.now() < self.expires_at

    @classmethod
    def send_email(cls, user: User | RpcUser, token: str) -> None:
        pass
