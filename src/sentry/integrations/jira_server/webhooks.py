import logging

from django.core.exceptions import ObjectDoesNotExist
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.jira.utils import handle_assignee_change, handle_status_change
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import jwt

logger = logging.getLogger("sentry.integrations.jira_server.webhooks")


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


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, token, *args, **kwargs) -> Response:
        try:
            integration = get_integration_from_token(token)
        except ValueError as err:
            logger.info("token-validation-error", extra={"token": token, "error": str(err)})
            return self.respond(status=400)

        data = request.data

        if not data.get("changelog"):
            logger.info("missing-changelog", extra={"integration_id": integration.id})
            return self.respond()

        try:
            handle_assignee_change(integration, data)
            handle_status_change(integration, data)
        except (ApiError, ObjectDoesNotExist) as err:
            logger.info("sync-failed", extra={"token": token, "error": str(err)})
            return self.respond(status=400)
        else:
            return self.respond()
