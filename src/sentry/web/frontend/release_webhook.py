import hmac
import logging
from hashlib import sha256

from django.http import HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.api import client
from sentry.exceptions import HookValidationError
from sentry.models import ApiKey, Project, ProjectOption
from sentry.plugins.base import plugins
from sentry.utils import json

logger = logging.getLogger("sentry.webhooks")


class ReleaseWebhookView(View):
    def verify(self, plugin_id, project_id, token, signature):
        return constant_time_compare(
            signature,
            hmac.new(
                key=token.encode("utf-8"),
                msg=(f"{plugin_id}-{project_id}").encode("utf-8"),
                digestmod=sha256,
            ).hexdigest(),
        )

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def _handle_builtin(self, request, project):
        endpoint = f"/projects/{project.organization.slug}/{project.slug}/releases/"

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError as exc:
            return HttpResponse(
                status=400,
                content=json.dumps({"error": str(exc)}),
                content_type="application/json",
            )

        try:
            # Ideally the API client would support some kind of god-mode here
            # as we've already confirmed credentials and simply want to execute
            # the view code. Instead we hack around it with an ApiKey instance
            god = ApiKey(organization=project.organization, scope_list=["project:write"])

            resp = client.post(endpoint, data=data, auth=god)
        except client.ApiError as exc:
            return HttpResponse(
                status=exc.status_code,
                content=json.dumps(exc.body),
                content_type="application/json",
            )
        return HttpResponse(
            status=resp.status_code, content=json.dumps(resp.data), content_type="application/json"
        )

    def post(self, request, plugin_id, project_id, signature):
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            logger.warn(
                "release-webhook.invalid-project",
                extra={"project_id": project_id, "plugin_id": plugin_id},
            )
            return HttpResponse(status=404)

        logger.info(
            "release-webhook.incoming", extra={"project_id": project_id, "plugin_id": plugin_id}
        )

        token = ProjectOption.objects.get_value(project, "sentry:release-token")

        if token is None:
            logger.warn(
                "release-webhook.missing-token",
                extra={"project_id": project_id, "plugin_id": plugin_id},
            )
            return HttpResponse(status=403)

        if not self.verify(plugin_id, project_id, token, signature):
            logger.warn(
                "release-webhook.invalid-signature",
                extra={"project_id": project_id, "plugin_id": plugin_id},
            )
            return HttpResponse(status=403)

        if plugin_id == "builtin":
            return self._handle_builtin(request, project)

        plugin = plugins.get(plugin_id)
        if not plugin.is_enabled(project):
            logger.warn(
                "release-webhook.plugin-disabled",
                extra={"project_id": project_id, "plugin_id": plugin_id},
            )
            return HttpResponse(status=403)

        cls = plugin.get_release_hook()
        hook = cls(project)
        try:
            hook.handle(request)
        except HookValidationError as exc:
            return HttpResponse(
                status=400,
                content=json.dumps({"error": str(exc)}),
                content_type="application/json",
            )

        return HttpResponse(status=204)
