import logging

from django.core.exceptions import ObjectDoesNotExist
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.jira_server.utils import handle_assignee_change, handle_status_change
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import jwt

logger = logging.getLogger(__name__)


def get_integration_from_token(token):
    """
    When we create a jira server integration we create a webhook that contains
    a JWT in the URL. We use that JWT to locate the matching sentry integration later
    as Jira doesn't have any additional fields we can embed information in.
    """
    if not token:
        raise ValueError("Token was empty")

    try:
        unvalidated = jwt.peek_claims(token)
    except jwt.DecodeError:
        raise ValueError("Could not decode JWT token")
    if "id" not in unvalidated:
        raise ValueError("Token did not contain `id`")
    try:
        integration = Integration.objects.get(provider="jira_server", external_id=unvalidated["id"])
    except Integration.DoesNotExist:
        raise ValueError("Could not find integration for token")
    try:
        jwt.decode(token, integration.metadata["webhook_secret"])
    except Exception as err:
        raise ValueError(f"Could not validate JWT. Got {err}")

    return integration


@control_silo_endpoint
class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, token, *args, **kwargs) -> Response:
        clear_tags_and_context()
        extra = {}
        try:
            integration = get_integration_from_token(token)
            extra["integration_id"] = integration.id
        except ValueError as err:
            extra.update({"token": token, "error": str(err)})
            logger.info("token-validation-error", extra=extra)
            logger.exception("Invalid token.")
            return self.respond(status=400)

        data = request.data

        if not data.get("changelog"):
            logger.info("missing-changelog", extra=extra)
            return self.respond()

        try:
            handle_assignee_change(integration, data)
            handle_status_change(integration, data)
        except (ApiError, ObjectDoesNotExist) as err:
            extra.update({"token": token, "error": str(err)})
            logger.info("sync-failed", extra=extra)
            logger.exception("Invalid token.")
            return self.respond(status=400)
        else:
            return self.respond()
