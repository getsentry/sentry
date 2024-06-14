import logging

from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator

from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.integrations.utils import get_identity_or_404
from sentry.models.identity import Identity
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.notifications.integration_nudge import IntegrationNudgeNotification
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from ..utils import send_slack_response
from . import build_linking_url as base_build_linking_url
from . import never_cache

_logger = logging.getLogger(__name__)

SUCCESS_LINKED_MESSAGE = (
    "Your Slack identity has been linked to your Sentry account. You're good to go!"
)


def build_linking_url(
    integration: RpcIntegration, slack_id: str, channel_id: str, response_url: str
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

    _METRICS_SUCCESS_KEY = "sentry.integrations.slack.link_identity_view.success"
    _METRICS_FAILURE_KEY = "sentry.integrations.slack.link_identity_view.failure"

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        try:
            signed_params = kwargs.pop("signed_params")
            params = unsign(signed_params)
        except (SignatureExpired, BadSignature) as e:
            _logger.warning("dispatch.signature_error", exc_info=e)
            metrics.incr(self._METRICS_FAILURE_KEY, tags={"error": str(e)}, sample_rate=1.0)
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                request=request,
            )

        try:
            organization, integration, idp = get_identity_or_404(
                ExternalProviders.SLACK,
                request.user,
                integration_id=params["integration_id"],
            )
        except Http404:
            _logger.exception(
                "get_identity_error", extra={"integration_id": params["integration_id"]}
            )
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_identity", sample_rate=1.0)
            raise

        _logger.info("get_identity_success", extra={"integration_id": params["integration_id"]})
        metrics.incr(self._METRICS_SUCCESS_KEY + ".get_identity", sample_rate=1.0)
        params.update({"organization": organization, "integration": integration, "idp": idp})
        return super().dispatch(request, params=params)

    def get(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        params = kwargs["params"]
        organization, integration = params["organization"], params["integration"]

        return render_to_response(
            "sentry/auth-link-identity.html",
            request=request,
            context={"organization": organization, "provider": integration.get_provider()},
        )

    def post(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        params = kwargs["params"]
        organization, integration, idp = (
            params["organization"],
            params["integration"],
            params["idp"],
        )

        try:
            Identity.objects.link_identity(
                user=request.user, idp=idp, external_id=params["slack_id"]
            )
        except IntegrityError:
            _logger.exception("slack.link.integrity_error")
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".post.identity.integrity_error",
                sample_rate=1.0,
            )
            raise Http404

        send_slack_response(integration, SUCCESS_LINKED_MESSAGE, params, command="link")

        controller = NotificationController(
            recipients=[request.user],
            organization_id=organization.id,
            provider=ExternalProviderEnum.SLACK,
        )
        has_slack_settings = controller.user_has_any_provider_settings(ExternalProviderEnum.SLACK)

        if not has_slack_settings:
            IntegrationNudgeNotification(organization, request.user, ExternalProviders.SLACK).send()

        _logger.info("link_identity_success", extra={"slack_id": params["slack_id"]})
        metrics.incr(self._METRICS_SUCCESS_KEY + ".post.link_identity", sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/linked.html",
            request=request,
            context={"channel_id": params["channel_id"], "team_id": integration.external_id},
        )
