from __future__ import absolute_import

import inspect
from datetime import timedelta
from django.utils import timezone


class UserActiveMiddleware(object):
    disallowed_paths = (
        "sentry.web.frontend.generic.static_media",
        "sentry.web.frontend.organization_avatar",
        "sentry.web.frontend.project_avatar",
        "sentry.web.frontend.team_avatar",
        "sentry.web.frontend.user_avatar",
        "sentry.web.frontend.js_sdk_loader",
    )

    def process_view(self, request, view_func, view_args, view_kwargs):
        view = view_func
        if not inspect.isfunction(view_func):
            view = view.__class__

        try:
            path = "%s.%s" % (view.__module__, view.__name__)
        except AttributeError:
            return

        if path.startswith(self.disallowed_paths):
            return

        if not request.user.is_authenticated():
            return

        now = timezone.now()
        freq = timedelta(minutes=5)
        last_active = request.user.last_active

        if last_active and freq > (now - last_active):
            return

        request.user.last_active = now
        request.user.update(last_active=now)
