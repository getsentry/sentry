from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone


class UserActiveMiddleware(object):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not request.user.is_authenticated():
            return

        now = timezone.now()
        freq = timedelta(minutes=60)
        last_active = request.user.last_active

        if last_active and freq > (now - last_active):
            return

        request.user.last_active = now
        request.user.update(last_active=now)
