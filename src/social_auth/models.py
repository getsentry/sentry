from __future__ import annotations

import re
from typing import Any

from django.apps import apps
from django.conf import settings
from django.db import models

from sentry.db.models import control_silo_only_model

from .fields import JSONField
from .utils import setting

AUTH_USER_MODEL = settings.AUTH_USER_MODEL

UID_LENGTH = setting("SOCIAL_AUTH_UID_LENGTH", 255)
NONCE_SERVER_URL_LENGTH = setting("SOCIAL_AUTH_NONCE_SERVER_URL_LENGTH", 255)
ASSOCIATION_SERVER_URL_LENGTH = setting("SOCIAL_AUTH_ASSOCIATION_SERVER_URL_LENGTH", 255)
ASSOCIATION_HANDLE_LENGTH = setting("SOCIAL_AUTH_ASSOCIATION_HANDLE_LENGTH", 255)

CLEAN_USERNAME_REGEX = re.compile(r"[^\w.@+-_]+", re.UNICODE)


@control_silo_only_model
class UserSocialAuth(models.Model):
    """Social Auth association model"""

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(AUTH_USER_MODEL, related_name="social_auth", on_delete=models.CASCADE)
    provider = models.CharField(max_length=32)
    uid = models.CharField(max_length=UID_LENGTH)
    extra_data: models.Field[dict[str, Any], dict[str, Any]] = JSONField(default="{}")

    class Meta:
        """Meta data"""

        unique_together = ("provider", "uid", "user")
        app_label = "social_auth"

    def __str__(self):
        """Return associated user unicode representation"""
        return f"{self.user} - {self.provider.title()}"

    def get_backend(self):
        from .utils import get_backend

        return get_backend(instance=self)

    @property
    def tokens(self):
        from .utils import tokens

        return tokens(instance=self)

    def expiration_datetime(self):
        from .utils import expiration_datetime

        return expiration_datetime(instance=self)

    def revoke_token(self, drop_token=True):
        """Attempts to revoke permissions for provider."""
        if "access_token" in self.tokens:
            success = self.get_backend().revoke_token(self.tokens["access_token"], self.uid)
            if success and drop_token:
                self.extra_data.pop("access_token", None)
                self.save()

    def refresh_token(self):
        refresh_token = self.extra_data.get("refresh_token")
        if refresh_token:
            backend = self.get_backend()
            if hasattr(backend, "refresh_token"):
                response = backend.refresh_token(refresh_token, self.provider)
                new_access_token = response.get("access_token")
                # We have not got a new access token, so don't lose the
                # existing one.
                if not new_access_token:
                    return
                self.extra_data["access_token"] = new_access_token
                # New refresh token might be given.
                new_refresh_token = response.get("refresh_token")
                if new_refresh_token:
                    self.extra_data["refresh_token"] = new_refresh_token
                self.save()

    @classmethod
    def clean_username(cls, value):
        return CLEAN_USERNAME_REGEX.sub("", value)

    @classmethod
    def user_username(cls, user):
        if hasattr(user, "USERNAME_FIELD"):
            # Django 1.5 custom user model, 'username' is just for internal
            # use, doesn't imply that the model should have an username field
            field_name = user.USERNAME_FIELD
        else:
            field_name = "username"
        return getattr(user, field_name)

    @classmethod
    def username_field(cls, values):
        user_model = cls.user_model()
        if hasattr(user_model, "USERNAME_FIELD"):
            # Django 1.5 custom user model, 'username' is just for internal
            # use, doesn't imply that the model should have an username field
            values[user_model.USERNAME_FIELD] = values.pop("username")
        return values

    @classmethod
    def simple_user_exists(cls, *args, **kwargs):
        """
        Return True/False if a User instance exists with the given arguments.
        Arguments are directly passed to filter() manager method.
        TODO: consider how to ensure case-insensitive email matching
        """
        kwargs = cls.username_field(kwargs)
        return cls.user_model().objects.filter(*args, **kwargs).exists()

    @classmethod
    def create_user(cls, *args, **kwargs):
        kwargs = cls.username_field(kwargs)
        return cls.user_model().objects.create_user(*args, **kwargs)

    @classmethod
    def get_user(cls, pk):
        try:
            return cls.user_model().objects.get(pk=pk)
        except cls.user_model().DoesNotExist:
            return None

    @classmethod
    def get_user_by_email(cls, email):
        """Case insensitive search"""
        # Do case-insensitive match, since real-world email address is
        # case-insensitive.
        return cls.user_model().objects.get(email__iexact=email)

    @classmethod
    def resolve_user_or_id(cls, user_or_id):
        if isinstance(user_or_id, cls.user_model()):
            return user_or_id
        return cls.user_model().objects.get(pk=user_or_id)

    @classmethod
    def get_social_auth_for_user(cls, user):
        return user.social_auth.all()

    @classmethod
    def create_social_auth(cls, user, uid, provider):
        if not isinstance(uid, str):
            uid = str(uid)
        return cls.objects.create(user_id=user.id, uid=uid, provider=provider)

    @classmethod
    def get_social_auth(cls, provider, uid, user):
        try:
            instance = cls.objects.get(provider=provider, uid=uid, user_id=user.id)
            return instance
        except UserSocialAuth.DoesNotExist:
            return None

    @classmethod
    def username_max_length(cls):
        return cls._field_length("USERNAME_FIELD", "username")

    @classmethod
    def email_max_length(cls):
        return cls._field_length("EMAIL_FIELD", "email")

    @classmethod
    def _field_length(self, setting_name, default_name):
        model = UserSocialAuth.user_model()
        field_name = getattr(model, setting_name, default_name)
        return model._meta.get_field(field_name).max_length

    @classmethod
    def user_model(cls):
        db, name = AUTH_USER_MODEL.split(".")
        return apps.get_model(db, name)
