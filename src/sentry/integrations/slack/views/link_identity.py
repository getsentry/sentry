from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from rest_framework.request import Request

from sentry.integrations.utils import get_identity_or_404
from sentry.models.identity import Identity
from sentry.models.integrations.integration import Integration
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.notifications.integration_nudge import IntegrationNudgeNotification
from sentry.types.integrations import ExternalProviderEnum, ExternalProviders
from sentry.utils.signing import unsign
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from ..utils import send_slack_response
from . import build_linking_url as base_build_linking_url
from . import never_cache

SUCCESS_LINKED_MESSAGE = (
    "Your Slack identity has been linked to your Sentry account. You're good to go!"
)


def build_linking_url(
    integration: Integration, slack_id: str, channel_id: str, response_url: str
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-link-identity",
        integration_id=integration.id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )


@control_silo_view
class SlackLinkIdentityView(BaseView):
    """
    Django view for linking user to slack account. Creates an entry on Identity table.
    """

    @transaction_start("SlackLinkIdentityView")
    @method_decorator(never_cache)
    def handle(self, request: Request, signed_params: str) -> HttpResponse:
        try:
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature):
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                request=request,
            )

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.SLACK,
            request.user,
            integration_id=params["integration_id"],
        )

        if request.method != "POST":
            return render_to_response(
                "sentry/auth-link-identity.html",
                request=request,
                context={"organization": organization, "provider": integration.get_provider()},
            )

        Identity.objects.link_identity(user=request.user, idp=idp, external_id=params["slack_id"])

        send_slack_response(integration, SUCCESS_LINKED_MESSAGE, params, command="link")
        has_slack_settings = None
        controller = NotificationController(
            recipients=[request.user],
            organization_id=organization.id,
            provider=ExternalProviderEnum.SLACK,
        )
        has_slack_settings = controller.user_has_any_provider_settings(ExternalProviderEnum.SLACK)

        if not has_slack_settings:
            IntegrationNudgeNotification(organization, request.user, ExternalProviders.SLACK).send()

        # TODO(epurkhiser): We could do some fancy slack querying here to
        #  render a nice linking page with info about the user their linking.
        return render_to_response(
            "sentry/integrations/slack/linked.html",
            request=request,
            context={"channel_id": params["channel_id"], "team_id": integration.external_id},
        )
