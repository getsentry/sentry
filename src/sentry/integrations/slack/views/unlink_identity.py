import logging

from django.core.signing import BadSignature, SignatureExpired
from django.db import IntegrityError
from django.http import Http404, HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator

from sentry.integrations.slack.utils.notifications import send_slack_response
from sentry.integrations.slack.views import build_linking_url as base_build_linking_url
from sentry.integrations.slack.views import never_cache
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils import get_identity_or_404
from sentry.models.identity import Identity
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.helpers import render_to_response

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

    _METRICS_SUCCESS_KEY = "sentry.integrations.slack.unlink_identity_view.success"
    _METRICS_FAILURE_KEY = "sentry.integrations.slack.unlink_identity_view.failure"

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, signed_params: str) -> HttpResponseBase:
        try:
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
            "sentry/auth-unlink-identity.html",
            request=request,
            context={"organization": organization, "provider": integration.get_provider()},
        )

    def post(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        params = kwargs["params"]
        integration, idp = params["integration"], params["idp"]

        try:
            Identity.objects.filter(idp_id=idp.id, external_id=params["slack_id"]).delete()
        except IntegrityError:
            _logger.exception("slack.unlink.integrity-error")
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".post.identity.integrity_error",
                sample_rate=1.0,
            )
            raise Http404

        send_slack_response(integration, SUCCESS_UNLINKED_MESSAGE, params, command="unlink")

        _logger.info("unlink_identity_success", extra={"slack_id": params["slack_id"]})
        metrics.incr(self._METRICS_SUCCESS_KEY + ".post.unlink_identity", sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/unlinked.html",
            request=request,
            context={"channel_id": params["channel_id"], "team_id": integration.external_id},
        )
