import re
import time
from datetime import datetime, timedelta

from django.apps import apps
from django.conf import settings
from django.db import models

from .fields import JSONField
from .utils import setting

AUTH_USER_MODEL = settings.AUTH_USER_MODEL

UID_LENGTH = setting("SOCIAL_AUTH_UID_LENGTH", 255)
NONCE_SERVER_URL_LENGTH = setting("SOCIAL_AUTH_NONCE_SERVER_URL_LENGTH", 255)
ASSOCIATION_SERVER_URL_LENGTH = setting("SOCIAL_AUTH_ASSOCIATION_SERVER_URL_LENGTH", 255)
ASSOCIATION_HANDLE_LENGTH = setting("SOCIAL_AUTH_ASSOCIATION_HANDLE_LENGTH", 255)

CLEAN_USERNAME_REGEX = re.compile(r"[^\w.@+-_]+", re.UNICODE)


class UserSocialAuth(models.Model):
    """Social Auth association model"""

    user = models.ForeignKey(AUTH_USER_MODEL, related_name="social_auth", on_delete=models.CASCADE)
    provider = models.CharField(max_length=32)
    uid = models.CharField(max_length=UID_LENGTH)
    extra_data = JSONField(default="{}")

    class Meta:
        """Meta data"""

        unique_together = ("provider", "uid", "user")
        app_label = "social_auth"

    def __str__(self):
        """Return associated user unicode representation"""
        return f"{self.user} - {self.provider.title()}"

    def get_backend(self):
        # Make import here to avoid recursive imports :-/
        from social_auth.backends import get_backends

        return get_backends().get(self.provider)

    @property
    def tokens(self):
        """
        .. function: tokens()

            Return access_token stored in extra_data or None
        """
        """Return access_token stored in extra_data or None"""
        backend = self.get_backend()
        if backend:
            return backend.AUTH_BACKEND.tokens(self)
        else:
            return {}

    def revoke_token(self, drop_token=True):
        """Attempts to revoke permissions for provider."""
        if "access_token" in self.tokens:
            success = self.get_backend().revoke_token(self.tokens["access_token"], self.uid)
            if success and drop_token:
                self.extra_data.pop("access_token", None)
                self.save()

    def refresh_token(self):
        """
        Refreshes the access token if it's expired.

        If the access token is not expired, this function does nothing. If it's expired, then this function will
        call the refresh_token method of the backend that was used to obtain a connection to that provider (e.g., Facebook or Twitter) and get a new one from
        them using your refresh token. The new access token will be stored in your extra data as "access_token". It also saves this updated extra data dict to
        your UserSocialAuth model instance in the database by calling `self.save()`.
        """
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

    def expiration_datetime(self):
        """Return provider session live seconds. Returns a timedelta ready to
        use with session.set_expiry().

        If provider returns a timestamp instead of session seconds to live, the
        timedelta is inferred from current time (using UTC timezone). None is
        returned if there's no value stored or it's invalid.
        """
        if self.extra_data and "expires" in self.extra_data:
            try:
                expires = int(self.extra_data["expires"])
            except (ValueError, TypeError):
                return None

            now = datetime.utcnow()

            # Detect if expires is a timestamp
            if expires > time.mktime(now.timetuple()):
                # expires is a datetime
                return datetime.fromtimestamp(expires) - now
            else:
                # expires is a timedelta
                return timedelta(seconds=expires)

    @classmethod
    def clean_username(cls, value):
        return CLEAN_USERNAME_REGEX.sub("", value)

    @classmethod
    def user_username(cls, user):
        """
        .. function: user_username(user)

            Returns the username for a given user object.  If the user object is
            a custom user model (Django 1.5+),
        `USERNAME_FIELD` must be specified in
            your settings to determine which field will be used as the username for
            users that are not using the
        default authentication backend.
            :param cls: The class of Django's User model being used, usually `User`.
                This parameter is only needed if
        you're using a custom User model and need to specify its USERNAME_FIELD setting.
        """
        if hasattr(user, "USERNAME_FIELD"):
            # Django 1.5 custom user model, 'username' is just for internal
            # use, doesn't imply that the model should have an username field
            field_name = user.USERNAME_FIELD
        else:
            field_name = "username"
        return getattr(user, field_name)

    @classmethod
    def username_field(cls, values):
        """
        Converts a `dict` of values into the `user_model` fields, taking into
        account custom user models that define extra or different fields.

        :param cls:
        The User model to use for field names.
        :type cls: type

        :param values: A dict with keys corresponding to the `cls` model field names.
            For example,
        if you have a custom user model with two extra fields, 'age' and 'bio', then this function should be called like so:
        """
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
        """
        Returns the user with given email address.

        :param cls:
            A User class/model to perform the query on.
        :type cls: ``django.contrib.auth.models.User``
        or subclass thereof

        :param email: The e-mail address of a user account to search for, case insensitively
        :type email: str

        :returns: The first (and
        only) object found matching that e-mail address, or None if no such object exists in the database
        """
        # Do case-insensitive match, since real-world email address is
        # case-insensitive.
        return cls.user_model().objects.get(email__iexact=email)

    @classmethod
    def resolve_user_or_id(cls, user_or_id):
        """
        .. function: resolve_user_or_id(cls, user_or_id)

            :param cls:
            :type cls:
            :param user_or_id:
            :type user_or_id:
        """
        if isinstance(user_or_id, cls.user_model()):
            return user_or_id
        return cls.user_model().objects.get(pk=user_or_id)

    @classmethod
    def get_social_auth_for_user(cls, user):
        return user.social_auth.all()

    @classmethod
    def create_social_auth(cls, user, uid, provider):
        """
        Create a new ``SocialAuth`` instance for a given user.

        :param user: The user to create the social auth for.
        """
        if not isinstance(uid, str):
            uid = str(uid)
        return cls.objects.create(user=user, uid=uid, provider=provider)

    @classmethod
    def get_social_auth(cls, provider, uid, user):
        """
        Get or create an instance of UserSocialAuth for the given provider and uid.
        """
        try:
            instance = cls.objects.get(provider=provider, uid=uid, user=user)
            instance.user = user
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
        """
        .. function:_field_length(setting_name, default_name)

            :param setting_name: The name of the model field to use.
            :type setting_name: str
        :param default_name: The name of the model field to use if *setting* is not set.
            :type default-nmae: str

            Returns the max length for a
        UserSocialAuth database field named *default-nmae* or *setting-nmae*.  If neither fields exist, returns ``None``.
        """
        model = UserSocialAuth.user_model()
        field_name = getattr(model, setting_name, default_name)
        return model._meta.get_field(field_name).max_length

    @classmethod
    def user_model(cls):
        return apps.get_model(*AUTH_USER_MODEL.split("."))
