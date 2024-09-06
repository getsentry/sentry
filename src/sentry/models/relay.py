from typing import Any

from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property
from sentry_relay.auth import PublicKey

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.mixins import OverwritableConfigMixin
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model


@region_silo_model
class RelayUsage(OverwritableConfigMixin, Model):
    __relocation_scope__ = RelocationScope.Config
    __relocation_custom_ordinal__ = ["relay_id", "version"]

    relay_id = models.CharField(max_length=64)
    version = models.CharField(max_length=32, default="0.0.1")
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)
    public_key = models.CharField(max_length=200, null=True, db_index=True)

    class Meta:
        unique_together = (("relay_id", "version"),)
        app_label = "sentry"
        db_table = "sentry_relayusage"

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_uuid(json, SanitizableField(model_name, "relay_id"))
        sanitizer.set_string(json, SanitizableField(model_name, "public_key"))


@region_silo_model
class Relay(OverwritableConfigMixin, Model):
    __relocation_scope__ = RelocationScope.Config
    __relocation_custom_ordinal__ = ["relay_id"]

    relay_id = models.CharField(max_length=64, unique=True)
    public_key = models.CharField(max_length=200)
    # not used, functionality replaced by RelayUsage
    first_seen = models.DateTimeField(default=None, null=True)
    # not used, functionality replaced by RelayUsage
    last_seen = models.DateTimeField(default=None, null=True)
    is_internal = models.BooleanField(default=None, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_relay"

    @cached_property
    def public_key_object(self):
        return PublicKey.parse(self.public_key)

    def has_org_access(self, org):
        # Internal relays always have access
        if self.is_internal:
            return True

        trusted_relays = org.get_option("sentry:trusted-relays", [])
        key = str(self.public_key_object)

        for relay_info in trusted_relays:
            if relay_info is not None and relay_info.get("public_key") == key:
                return True

        return False

    @staticmethod
    def for_keys(keys):
        """
        Returns all the relays that are configured with one of the specified keys
        """
        return Relay.objects.filter(public_key__in=keys)

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_uuid(json, SanitizableField(model_name, "relay_id"))
        sanitizer.set_string(json, SanitizableField(model_name, "public_key"))
