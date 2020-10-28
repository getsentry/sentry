from __future__ import absolute_import

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.geo import geo_by_addr


class UserIP(Model):
    __core__ = True

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
    def log(cls, user, ip_address):
        # Only log once every 5 minutes for the same user/ip_address pair
        # since this is hit pretty frequently by all API calls in the UI, etc.
        cache_key = "userip.log:%d:%s" % (user.id, ip_address)
        if cache.get(cache_key):
            return

        try:
            geo = geo_by_addr(ip_address)
        except Exception:
            geo = None

        values = {"last_seen": timezone.now()}
        if geo:
            values.update({"country_code": geo["country_code"], "region_code": geo["region"]})

        UserIP.objects.create_or_update(user=user, ip_address=ip_address, values=values)
        cache.set(cache_key, 1, 300)
