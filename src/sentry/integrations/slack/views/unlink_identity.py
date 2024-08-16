import logging

from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from rest_framework.request import Request

from sentry.integrations.slack.metrics import (
    SLACK_BOT_COMMAND_UNLINK_IDENTITY_FAILURE_DATADOG_METRIC,
    SLACK_BOT_COMMAND_UNLINK_IDENTITY_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.utils.notifications import respond_to_slack_command
from sentry.integrations.slack.views import build_linking_url as base_build_linking_url
from sentry.integrations.slack.views import never_cache, render_error_page
from sentry.integrations.slack.views.types import IdentityParams
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils import get_identity_or_404
from sentry.users.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

from . import SALT

SUCCESS_UNLINKED_MESSAGE = "Your Slack identity has been unlinked from your Sentry account."

_logger = logging.getLogger(__name__)


def build_unlinking_url(
    integration_id: int, slack_id: str, channel_id: str, response_url: str
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-unlink-identity",
        integration_id=integration_id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )


@control_silo_view
class SlackUnlinkIdentityView(BaseView):
    """
    Django view for unlinking user from slack account. Deletes from Identity table.
    """

    _METRICS_SUCCESS_KEY = SLACK_BOT_COMMAND_UNLINK_IDENTITY_SUCCESS_DATADOG_METRIC
    _METRICS_FAILURE_KEY = SLACK_BOT_COMMAND_UNLINK_IDENTITY_FAILURE_DATADOG_METRIC

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, signed_params: str) -> HttpResponseBase:
        try:
            params = unsign(signed_params, salt=SALT)
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
            return render_error_page(
                request,
                status=404,
                body_text="HTTP 404: Could not find the Slack identity.",
            )

        _logger.info("get_identity_success", extra={"integration_id": params["integration_id"]})
        metrics.incr(self._METRICS_SUCCESS_KEY + ".get_identity", sample_rate=1.0)
        params.update({"organization": organization, "integration": integration, "idp": idp})
        return super().dispatch(
            request, organization=organization, integration=integration, idp=idp, params=params
        )

    def get(self, request: Request, *args, **kwargs) -> HttpResponse:
        params = kwargs["params"]
        organization, integration = params["organization"], params["integration"]

        return render_to_response(
            "sentry/auth-unlink-identity.html",
            request=request,
            context={"organization": organization, "provider": integration.get_provider()},
        )

    def post(self, request: Request, *args, **kwargs) -> HttpResponse:
        try:
            params_dict = kwargs["params"]
            params = IdentityParams(
                organization=kwargs["organization"],
                integration=kwargs["integration"],
                idp=kwargs["idp"],
                slack_id=params_dict["slack_id"],
                channel_id=params_dict["channel_id"],
                response_url=params_dict.get("response_url"),
            )
        except KeyError as e:
            _logger.exception("slack.unlink.missing_params", extra={"error": str(e)})
            metrics.incr(self._METRICS_FAILURE_KEY + ".post.missing_params", sample_rate=1.0)
            return render_error_page(
                request,
                status=400,
                body_text="HTTP 400: Missing required parameters.",
            )

        try:
            Identity.objects.filter(idp_id=params.idp, external_id=params.slack_id).delete()
        except IntegrityError:
            _logger.exception("slack.unlink.integrity_error")
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".post.identity.integrity_error",
                sample_rate=1.0,
            )
            raise Http404

        respond_to_slack_command(params, SUCCESS_UNLINKED_MESSAGE, command="link")

        metrics.incr(self._METRICS_SUCCESS_KEY + ".post.unlink_identity", sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/unlinked.html",
            request=request,
            context={"channel_id": params.channel_id, "team_id": params.integration.external_id},
        )
