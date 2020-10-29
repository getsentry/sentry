from __future__ import absolute_import, print_function

from django.utils.encoding import force_text, python_2_unicode_compatible
from datetime import timedelta
from django.db import models, transaction
from django.utils import timezone
from uuid import uuid4

from sentry.models.apiscopes import HasApiScopes
from sentry.db.models import Model, BaseManager, FlexibleForeignKey, sane_repr

DEFAULT_EXPIRATION = timedelta(days=30)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_token():
    return uuid4().hex + uuid4().hex


@python_2_unicode_compatible
class ApiToken(Model, HasApiScopes):
    __core__ = True

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    user = FlexibleForeignKey("sentry.User")
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    refresh_token = models.CharField(max_length=64, unique=True, null=True, default=generate_token)
    expires_at = models.DateTimeField(null=True, default=default_expiration)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("token",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apitoken"

    __repr__ = sane_repr("user_id", "token", "application_id")

    def __str__(self):
        return force_text(self.token)

    @classmethod
    def from_grant(cls, grant):
        with transaction.atomic():
            return cls.objects.create(
                application=grant.application, user=grant.user, scope_list=grant.get_scopes()
            )

    def is_expired(self):
        if not self.expires_at:
            return False

        return timezone.now() >= self.expires_at

    def get_audit_log_data(self):
        return {"scopes": self.get_scopes()}

    def get_allowed_origins(self):
        if self.application:
            return self.application.get_allowed_origins()
        return ()

    def refresh(self, expires_at=None):
        if expires_at is None:
            expires_at = timezone.now() + DEFAULT_EXPIRATION

        self.update(token=generate_token(), refresh_token=generate_token(), expires_at=expires_at)
