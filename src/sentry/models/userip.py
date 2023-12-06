from __future__ import annotations

from typing import Optional, Tuple

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_only_model, sane_repr
from sentry.models.user import User
from sentry.services.hybrid_cloud.log import UserIpEvent, log_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.utils.geo import geo_by_addr


@control_silo_only_model
class UserIP(Model):
    __relocation_scope__ = RelocationScope.User
    __relocation_custom_ordinal__ = ["user", "ip_address"]

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    ip_address = models.GenericIPAddressField()
    country_code = models.CharField(max_length=16, null=True)
    region_code = models.CharField(max_length=16, null=True)
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_userip"
        unique_together = (("user", "ip_address"),)

    __repr__ = sane_repr("user_id", "ip_address")

    @classmethod
    def log(cls, user: User | RpcUser, ip_address: str):
        # Only log once every 5 minutes for the same user/ip_address pair
        # since this is hit pretty frequently by all API calls in the UI, etc.
        cache_key = f"userip.log:{user.id}:{ip_address}"
        if not cache.get(cache_key):
            _perform_log(user, ip_address)
            cache.set(cache_key, 1, 300)

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> Optional[int]:
        from sentry.models.user import User

        old_user_id = self.user_id
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # If we are merging users, ignore the imported IP and use the existing user's IP instead.
        if pk_map.get_kind(get_model_name(User), old_user_id) == ImportKind.Existing:
            return None

        # We'll recalculate the country codes from the IP when we call `log()` in
        # `write_relocation_import()`.
        self.country_code = None
        self.region_code = None

        # Only preserve the submitted timing data in the backup/restore scope.
        if scope != ImportScope.Global:
            self.first_seen = self.last_seen = timezone.now()

        return old_pk

    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # Ensures that the IP address is valid. Exclude the codes, as they should be `None` until we
        # `log()` them below.
        self.full_clean(exclude=["country_code", "region_code", "user"])

        # Update country/region codes as necessary by using the `log()` method.
        (userip, _) = self.__class__.objects.get_or_create(
            user=self.user, ip_address=self.ip_address
        )

        # Calling the `.log()` method makes a separate "update" call to the database, so we need to
        # refresh this local version of the model immediately after.
        self.__class__.log(self.user, self.ip_address)
        userip.refresh_from_db()

        userip.first_seen = self.first_seen
        userip.last_seen = self.last_seen
        userip.save()

        self.country_code = userip.country_code
        self.region_code = userip.region_code

        # If we've entered this method at all, we can be sure that the `UserIP` was created as part
        # of the import, since this is a new `User` (the "existing" `User` due to
        # `--merge_users=true` case is handled in the `normalize_before_relocation_import()` method
        # above).
        return (userip.pk, ImportKind.Inserted)


def _perform_log(user: User | RpcUser, ip_address: str):
    try:
        geo = geo_by_addr(ip_address)
    except Exception:
        geo = None

    event = UserIpEvent(
        user_id=user.id,
        ip_address=ip_address,
        last_seen=timezone.now(),
    )

    if geo:
        event.country_code = geo["country_code"]
        event.region_code = geo["region"]

    log_service.record_user_ip(event=event)
