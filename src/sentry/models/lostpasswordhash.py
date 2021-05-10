from datetime import timedelta

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.http import absolute_uri

CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


class LostPasswordHash(Model):
    __core__ = False

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

    def set_hash(self):
        from django.utils.crypto import get_random_string

        self.hash = get_random_string(32, CHARACTERS)

    def is_valid(self):
        return self.date_added > timezone.now() - timedelta(hours=48)

    def get_absolute_url(self, mode="recover"):
        url_key = "sentry-account-recover-confirm"
        if mode == "set_password":
            url_key = "sentry-account-set-password-confirm"

        return absolute_uri(reverse(url_key, args=[self.user.id, self.hash]))

    def send_email(self, request, mode="recover"):
        from sentry import options
        from sentry.http import get_server_hostname
        from sentry.utils.email import MessageBuilder

        context = {
            "user": self.user,
            "domain": get_server_hostname(),
            "url": self.get_absolute_url(mode),
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
        msg.send_async([self.user.email])

    @classmethod
    def for_user(cls, user):
        # NOTE(mattrobenolt): Some security people suggest we invalidate
        # existing password hashes, but this opens up the possibility
        # of a DoS vector where then password resets are continually
        # requested, thus preventing someone from actually resetting
        # their password.
        # See: https://github.com/getsentry/sentry/pull/17299
        password_hash, created = cls.objects.get_or_create(user=user)
        if not password_hash.is_valid():
            password_hash.date_added = timezone.now()
            password_hash.set_hash()
            password_hash.save()

        return password_hash
