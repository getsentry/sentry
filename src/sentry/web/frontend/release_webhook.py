from __future__ import absolute_import, print_function

from hashlib import sha256
import hmac
import logging
import six
from simplejson import JSONDecodeError

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator

from sentry.api import client
from sentry.models import ApiKey, Project, ProjectOption
from sentry.plugins import plugins
from sentry.utils import json

logger = logging.getLogger('sentry.webhooks')


class ReleaseWebhookView(View):
    def verify(self, plugin_id, project_id, token, signature):
        return constant_time_compare(signature, hmac.new(
            key=token.encode('utf-8'),
            msg=('{}-{}'.format(plugin_id, project_id)).encode('utf-8'),
            digestmod=sha256
        ).hexdigest())

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super(ReleaseWebhookView, self).dispatch(*args, **kwargs)

    def _handle_builtin(self, request, project):
        endpoint = '/projects/{}/{}/releases/'.format(
            project.organization.slug,
            project.slug,
        )

        try:
            data = json.loads(request.body)
        except JSONDecodeError as exc:
            return HttpResponse(
                status=400,
                content=json.dumps({'error': six.text_type(exc)}),
                content_type='application/json',
            )

        try:
            # Ideally the API client would support some kind of god-mode here
            # as we've already confirmed credentials and simply want to execute
            # the view code. Instead we hack around it with an ApiKey instance
            god = ApiKey(
                organization=project.organization,
                scopes=getattr(ApiKey.scopes, 'project:write'),
            )

            resp = client.post(
                endpoint,
                data=data,
                auth=god,
            )
        except client.ApiError as exc:
            return HttpResponse(
                status=exc.status_code,
                content=exc.body,
                content_type='application/json',
            )
        return HttpResponse(
            status=resp.status_code,
            content=json.dumps(resp.data),
            content_type='application/json',
        )

    def post(self, request, plugin_id, project_id, signature):
        project = Project.objects.get_from_cache(id=project_id)

        token = ProjectOption.objects.get_value(project, 'sentry:release-token')

        logger.info('Incoming webhook for project_id=%s, plugin_id=%s',
                    project_id, plugin_id)

        if not self.verify(plugin_id, project_id, token, signature):
            logger.warn('Unable to verify signature for release hook')
            return HttpResponse(status=403)

        if plugin_id == 'builtin':
            return self._handle_builtin(request, project)

        plugin = plugins.get(plugin_id)
        if not plugin.is_enabled(project):
            logger.warn('Disabled release hook received for project_id=%s, plugin_id=%s',
                        project_id, plugin_id)
            return HttpResponse(status=403)

        cls = plugin.get_release_hook()
        hook = cls(project)
        hook.handle(request)

        return HttpResponse(status=204)
