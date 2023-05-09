from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models.user import User

from ..silo import SiloMode
from . import ViewFunc, get_path


class UserActiveMiddleware(MiddlewareMixin):
    disallowed_paths = (
        "sentry.web.frontend.generic.frontend_app_static_media",
        "sentry.web.frontend.generic.static_media",
        "sentry.web.frontend.organization_avatar",
        "sentry.web.frontend.project_avatar",
        "sentry.web.frontend.team_avatar",
        "sentry.web.frontend.user_avatar",
        "sentry.web.frontend.js_sdk_loader",
    )

    def process_view(
        self,
        request: Request,
        view_func: ViewFunc,
        view_args: Any,
        view_kwargs: Any,
    ) -> Response | None:
        path = get_path(view_func)
        if not path or path.startswith(self.disallowed_paths):
            return None

        if not request.user.is_authenticated:
            return None

        now = timezone.now()
        freq = timedelta(minutes=5)
        last_active = request.user.last_active

        if last_active and freq > (now - last_active):
            return None

        request.user.last_active = now
        # this also seems redundent with UserIP, can we somehow remove it?
        if SiloMode.get_current_mode() != SiloMode.REGION:
            user = User.objects.filter(id=request.user.id).first()
            if user:
                user.update(last_active=now)

        return None
