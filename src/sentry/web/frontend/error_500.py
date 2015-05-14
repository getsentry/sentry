from __future__ import absolute_import

import logging

from django.conf import settings
from django.views.generic import View
from django.template import Context, loader
from django.http import HttpResponseServerError

from sentry.models import ProjectKey


class Error500View(View):
    def dispatch(self, request):
        """
        500 error handler.

        Templates: `500.html`
        Context: None
        """
        context = {
            'request': request,
        }

        try:
            projectkey = ProjectKey.objects.filter(
                id=settings.SENTRY_PROJECT,
            )[0]
        except Exception:
            logging.warn('Unable to fetch ProjectKey for internal project')
        else:
            context['public_dsn'] = projectkey.dsn_public

        t = loader.get_template('sentry/500.html')
        return HttpResponseServerError(t.render(Context(context)))
