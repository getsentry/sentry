from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, control_silo_only_model, sane_repr
from sentry.models import User
from sentry.region_to_control.messages import UserIpEvent
from sentry.utils.geo import geo_by_addr


@control_silo_only_model
class UserIP(Model):
    __include_in_export__ = True

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
    def log(cls, user: User, ip_address: str):
        # Only log once every 5 minutes for the same user/ip_address pair
        # since this is hit pretty frequently by all API calls in the UI, etc.
        cache_key = f"userip.log:{user.id}:{ip_address}"
        if not cache.get(cache_key):
            _perform_log(user, ip_address)
            cache.set(cache_key, 1, 300)


def _perform_log(user: User, ip_address: str):
    from sentry.region_to_control.producer import user_ip_service

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

    user_ip_service.produce_user_ip(event)
