from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.utils.geo import geo_by_addr


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
    def log(cls, user, ip_address):
        """
        Logs the user's IP address and optionally their country code and region.

        :param user: The User object to log the IP for.
        :type user:
        :class:`~django.contrib.auth.models.User` or :class:"~django_user_ip_address"."UserIP"

            * If a User object is provided, it will be used to
        retrieve the ip address of that user if they are logged in, otherwise ``None`` will be returned instead of an ip address (since we can't get one).
        This allows this function to be called from anywhere without worrying about whether or not it was passed a valid request object with an associated
        authenticated session (e-mail) as long as you pass in either a UserIP model instance or None for ``user`` instead of a request object/session id
        pair).

            * If no such authenticated session exists but you provide either an AnonymousUser model instance or None for ``user`` then this function
        will return None since anonymous users don't have any IP addresses associated with them anyway (and also because there's no way to determine what
        their real e-mail would have been when they were anonymous so we can't look up their real IP information).
        """
        # Only log once every 5 minutes for the same user/ip_address pair
        # since this is hit pretty frequently by all API calls in the UI, etc.
        cache_key = f"userip.log:{user.id}:{ip_address}"
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
