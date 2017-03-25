from __future__ import absolute_import

from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def is_internal_ip(request):
    if not settings.INTERNAL_IPS:
        return False
    ip = request.META['REMOTE_ADDR']
    if not any(ip in addr for addr in settings.INTERNAL_IPS):
        return False
    return True


def is_privileged_request(request):
    if settings.INTERNAL_IPS:
        return is_internal_ip(request)
    return True


def is_active_superuser(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_superuser:
        return False

    return is_privileged_request(request)


def can_update_last_login(user):
    if not user or not user.is_authenticated():
        return False

    time_passed = timezone.now() - user.last_login
    interval_time = timedelta(seconds=settings.USER_LAST_LOGIN_UPDATE_INTERVAL)

    return time_passed > interval_time
