import logging

from django.core.exceptions import ObjectDoesNotExist
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, pending_silo_endpoint
from sentry.integrations.jira_server.utils import handle_assignee_change, handle_status_change
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
        return

    try:
        unvalidated = jwt.peek_claims(token)
    except jwt.DecodeError:
        logger.info("jwt-decode-error")
        return

    if "id" not in unvalidated:
        logger.info("token-missing-id")
        return

    try:
        integration = Integration.objects.get(provider="jira_server", external_id=unvalidated["id"])
    except Integration.DoesNotExist:
        logger.info("integration-missing-for-token")
        return

    try:
        jwt.decode(token, integration.metadata["webhook_secret"])
    except Exception as err:
        logger.info("token-validation-error", extra={"error": str(err)})
        return

    return integration


@pending_silo_endpoint
class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, token, *args, **kwargs) -> Response:
        integration = get_integration_from_token(token)
        if not integration:
            return self.respond(status=400)

        extra = {"integration_id": integration.id}

        data = request.data

        if not data.get("changelog"):
            logger.info("missing-changelog", extra=extra)
            return self.respond()

        try:
            handle_assignee_change(integration, data)
            handle_status_change(integration, data)
        except (ApiError, ObjectDoesNotExist) as err:
            extra.update({"error": str(err)})
            logger.info("sync-failed", extra=extra)
            return self.respond(status=400)
        else:
            return self.respond()
