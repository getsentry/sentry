from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, control_silo_only_model, sane_repr
from sentry.utils.http import absolute_uri
from sentry.utils.security import get_secure_token

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.lost_password_hash import APILostPasswordHash


@control_silo_only_model
class LostPasswordHash(Model):
    __include_in_export__ = False

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, unique=True)
    hash = models.CharField(max_length=32)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_lostpasswordhash"

    __repr__ = sane_repr("user_id", "hash")

    def save(self, *args, **kwargs):
        if not self.hash:
            self.set_hash()
        super().save(*args, **kwargs)

    def set_hash(self) -> None:
        self.hash = get_secure_token()

    def is_valid(self) -> bool:
        return self.date_added > timezone.now() - timedelta(hours=48)

    @classmethod
    def send_email(cls, user, hash, request, mode="recover") -> None:
        from sentry import options
        from sentry.http import get_server_hostname
        from sentry.utils.email import MessageBuilder

        context = {
            "user": user,
            "domain": get_server_hostname(),
            "url": cls.get_lostpassword_url(user.id, hash, mode),
            "datetime": timezone.now(),
            "ip_address": request.META["REMOTE_ADDR"],
        }

        template = "set_password" if mode == "set_password" else "recover_account"

        msg = MessageBuilder(
            subject="{}Password Recovery".format(options.get("mail.subject-prefix")),
            template=f"sentry/emails/{template}.txt",
            html_template=f"sentry/emails/{template}.html",
            type="user.password_recovery",
            context=context,
        )
        msg.send_async([user.email])

    # Duplicated from APILostPasswordHash
    def get_absolute_url(self, mode: str = "recover") -> str:
        return LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode)

    @classmethod
    def get_lostpassword_url(self, user_id: int, hash: str, mode: str = "recover") -> str:
        url_key = "sentry-account-recover-confirm"
        if mode == "set_password":
            url_key = "sentry-account-set-password-confirm"

        return absolute_uri(reverse(url_key, args=[user_id, hash]))

    @classmethod
    def for_user(cls, user) -> "APILostPasswordHash":
        from sentry.services.hybrid_cloud.lost_password_hash import lost_password_hash_service

        password_hash = lost_password_hash_service.get_or_create(user.id)
        return password_hash
