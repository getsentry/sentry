from __future__ import absolute_import

from django.utils import timezone
from datetime import timedelta
import inspect


class UserActiveMiddleware(object):
    allowed_paths = (
        'sentry.api.endpoints',
        'sentry.web.frontend',
    )

    def process_view(self, request, view_func, view_args, view_kwargs):
        if not request.user.is_authenticated():
            return

        now = timezone.now()
        freq = timedelta(minutes=60)
        last_active = request.user.last_active

        if last_active and freq > (now - last_active):
            return

        request.user.last_active = now
        request.user.save()

        view = view_func
        if not inspect.isfunction(view_func):
            view = view.__class__

        try:
            path = '%s.%s' % (view.__module__, view.__name__)
        except AttributeError:
            return

        if not path.startswith(self.allowed_paths):
            return
