import logging

from django.conf import settings
from django.views.generic import View

from sentry.models import ProjectKey
from sentry.utils import json
from sentry.web.helpers import render_to_response


class Error500View(View):
    def get_embed_config(self, request):
        if not hasattr(request, "sentry"):
            return

        try:
            projectkey = ProjectKey.objects.filter(project=settings.SENTRY_PROJECT)[0]
        except Exception:
            logging.exception("Unable to fetch ProjectKey for internal project")
            return

        result = {"dsn": projectkey.dsn_public, "eventId": request.sentry["id"]}
        if hasattr(request, "user") and request.user.is_authenticated:
            try:
                result.update({"userName": request.user.name, "userEmail": request.user.email})
            except Exception:
                logging.exception("Unable to fetch user information for embed")
        return result

    def dispatch(self, request):
        context = {}
        embed_config = self.get_embed_config(request)
        if embed_config:
            context["embed_config"] = json.dumps_htmlsafe(embed_config)

        return render_to_response("sentry/500.html", status=500, context=context, request=request)
