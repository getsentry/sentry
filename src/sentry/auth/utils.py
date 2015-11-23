from __future__ import absolute_import

from django.conf import settings


def is_active_superuser(request):
    user = getattr(request, 'user', None)
    if not user:
        return False

    if settings.INTERNAL_IPS:
        ip = request.META['REMOTE_ADDR']
        if not any(ip in addr for addr in settings.INTERNAL_IPS):
            return False

    return user.is_superuser
