from __future__ import absolute_import, print_function

import hashlib
import hmac
import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator

from sentry.models import Project, ProjectOption
from sentry.plugins import plugins


class ReleaseWebhookView(View):
    def verify(self, project_id, plugin_id, token, signature):
        return constant_time_compare(signature, hmac.new(
            key=str(token),
            msg='{}-{}'.format(plugin_id, project_id),
            digestmod=hashlib.sha256
        ).hexdigest())

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super(ReleaseWebhookView, self).dispatch(*args, **kwargs)

    def post(self, request, project_id, plugin_id, signature):
        project = Project.objects.get_from_cache(id=project_id)

        token = ProjectOption.objects.get_value(project, 'sentry:release-token')

        logging.info('Incoming webhook for project_id=%s, plugin_id=%s',
                     project_id, plugin_id)

        if not self.verify(project_id, plugin_id, token, signature):
            logging.warn('Unable to verify signature for release hook')
            return HttpResponse(status=403)

        plugin = plugins.get(plugin_id)
        if not plugin.is_enabled(project):
            logging.warn('Disabled release hook received for project_id=%s, plugin_id=%s',
                         project_id, plugin_id)
            return HttpResponse(status=403)

        cls = plugin.get_release_hook()
        hook = cls(project)
        hook.handle(request)

        return HttpResponse(status=204)
