from __future__ import absolute_import

import logging

from django.conf import settings
from django.views.generic import View
from django.template import Context, loader
from django.http import HttpResponseServerError
from django.utils.safestring import mark_safe

from sentry.models import ProjectKey
from sentry.utils import json


class Error500View(View):
    def get_embed_config(self, request):
        if not hasattr(request, 'sentry'):
            return

        try:
            projectkey = ProjectKey.objects.filter(
                project=settings.SENTRY_PROJECT,
            )[0]
        except Exception:
            logging.exception('Unable to fetch ProjectKey for internal project')
            return

        result = {
            'dsn': projectkey.dsn_public,
            'eventId': request.sentry['id'],
        }
        if hasattr(request, 'user') and request.user.is_authenticated():
            try:
                result.update({
                    'userName': request.user.name,
                    'userEmail': request.user.email,
                })
            except Exception:
                logging.exception('Unable to fetch user information for embed')
        return result

    def dispatch(self, request):
        """
        500 error handler.

        Templates: `500.html`
        Context: None
        """
        context = {
            'request': request,
        }

        embed_config = self.get_embed_config(request)
        if embed_config:
            context['embed_config'] = mark_safe(json.dumps(embed_config))

        t = loader.get_template('sentry/500.html')
        return HttpResponseServerError(t.render(Context(context)))
