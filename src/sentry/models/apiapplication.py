from urllib.parse import urlparse
from uuid import uuid4

import petname
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    EncryptedTextField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


def generate_name():
    return petname.Generate(2, " ", letters=10).title()


def generate_token():
    return uuid4().hex + uuid4().hex


class ApiApplicationStatus:
    active = 0
    inactive = 1
    pending_deletion = 2
    deletion_in_progress = 3


class ApiApplication(Model):
    __include_in_export__ = True

    client_id = models.CharField(max_length=64, unique=True, default=generate_token)
    client_secret = EncryptedTextField(default=generate_token)
    owner = FlexibleForeignKey("sentry.User")
    name = models.CharField(max_length=64, blank=True, default=generate_name)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ApiApplicationStatus.active, _("Active")),
            (ApiApplicationStatus.inactive, _("Inactive")),
        ),
        db_index=True,
    )
    allowed_origins = models.TextField(blank=True, null=True)
    redirect_uris = models.TextField()

    homepage_url = models.URLField(null=True)
    privacy_url = models.URLField(null=True)
    terms_url = models.URLField(null=True)

    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("client_id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiapplication"

    __repr__ = sane_repr("name", "owner_id")

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        return self.status == ApiApplicationStatus.active

    def is_allowed_response_type(self, value):
        return value in ("code", "token")

    def is_valid_redirect_uri(self, value):
        """
        Checks if the given value is a valid redirect URI for this client.

        :param str value: The URI to check.
        :returns bool: True if the given value is a
        valid redirect URI, False otherwise.
        """
        v_netloc = urlparse(value).netloc
        for ruri in self.redirect_uris.split("\n"):
            if v_netloc != urlparse(ruri).netloc:
                continue
            if value.startswith(ruri):
                return True
        return False

    def get_default_redirect_uri(self):
        return self.redirect_uris.split("\n", 1)[0]

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return [a for a in self.allowed_origins.split("\n") if a]

    def get_audit_log_data(self):
        """
        Get the audit log data for an OAuth application.

        :param client_id: The ID of the OAuth Application
        :type client_id: int
        :returns: dict -- a
        dictionary containing the audit log data for an OAuth application.

            * **client_id** - The ID of the associated Django auth user.
            * **name** -
        The name provided when the token was created
            * **redirect_uris** - A list of redirect URIs associated with this token, if any.  This is a string
        containing all URIs separated by newlines (\n).  If there are no redirect URIs, this will be ``None`` or an empty string.  This field is automatically
        managed and should not be modified directly unless you understand its limitations..
            * **allowed-origins** - A list of allowed origins associated
        with this token, if any.  This is a string containing all origins separated by newlines (\n). If there are no allowed origins, this will be ``None``
        or an empty string..   This field is automatically managed and should not be modified directly unless you understand its limitations..   It can only
        contain URLs that use HTTP or
        """
        return {
            "client_id": self.client_id,
            "name": self.name,
            "redirect_uris": self.redirect_uris,
            "allowed_origins": self.allowed_origins,
            "status": self.status,
        }
