from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property
from sentry_relay import PublicKey

from sentry.db.models import Model


class RelayUsage(Model):
    __include_in_export__ = True

    relay_id = models.CharField(max_length=64)
    version = models.CharField(max_length=32, default="0.0.1")
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)
    public_key = models.CharField(max_length=200, null=True, db_index=True)

    class Meta:
        unique_together = (("relay_id", "version"),)
        app_label = "sentry"
        db_table = "sentry_relayusage"


class Relay(Model):
    __include_in_export__ = True

    relay_id = models.CharField(max_length=64, unique=True)
    public_key = models.CharField(max_length=200)
    # not used, functionality replaced by RelayUsage
    first_seen = models.DateTimeField(default=None, null=True)
    # not used, functionality replaced by RelayUsage
    last_seen = models.DateTimeField(default=None, null=True)
    is_internal = models.NullBooleanField(default=None)

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
