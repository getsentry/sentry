import logging
from dataclasses import asdict

from django.core.signing import BadSignature, SignatureExpired
from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator

from sentry.api.helpers.teams import is_team_admin
from sentry.identity.services.identity import identity_service
from sentry.integrations.mixins import SUCCESS_UNLINKED_TEAM_MESSAGE, SUCCESS_UNLINKED_TEAM_TITLE
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.metrics import (
    SLACK_BOT_COMMAND_UNLINK_TEAM_FAILURE_DATADOG_METRIC,
    SLACK_BOT_COMMAND_UNLINK_TEAM_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.utils.auth import is_valid_role
from sentry.integrations.slack.views.types import TeamUnlinkRequest
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, region_silo_view
from sentry.web.helpers import render_to_response

from . import SALT
from . import build_linking_url as base_build_linking_url
from . import never_cache, render_error_page

_logger = logging.getLogger(__name__)

INSUFFICIENT_ACCESS = (
    "You must be a Sentry organization admin/manager/owner or a team admin to unlink a team."
)

ALLOWED_METHODS = ["GET", "POST"]


def build_team_unlinking_url(
    integration: Integration,
    organization_id: str,
    slack_id: str,
    channel_id: str,
    channel_name: str,
    response_url: str,
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-unlink-team",
        integration_id=integration.id,
        organization_id=organization_id,
        slack_id=slack_id,
        channel_name=channel_name,
        channel_id=channel_id,
        response_url=response_url,
    )


@region_silo_view
class SlackUnlinkTeamView(BaseView):
    """
    Django view for unlinking team from slack channel. Deletes from ExternalActor table.
    """

    _METRICS_SUCCESS_KEY = SLACK_BOT_COMMAND_UNLINK_TEAM_SUCCESS_DATADOG_METRIC
    _METRICS_FAILURE_KEY = SLACK_BOT_COMMAND_UNLINK_TEAM_FAILURE_DATADOG_METRIC

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, signed_params: str) -> HttpResponse:
        if request.method not in ALLOWED_METHODS:
            return HttpResponse(status=405)

        try:
            converted = unsign(signed_params, salt=SALT)
            unlink_team_request = TeamUnlinkRequest(**converted)
        except (SignatureExpired, BadSignature) as e:
            _logger.warning("dispatch.signature_error", exc_info=e)
            metrics.incr(self._METRICS_FAILURE_KEY, tags={"error": str(e)}, sample_rate=1.0)
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                request=request,
            )
        except TypeError:
            _logger.exception("dispatch.type_error")
            metrics.incr(self._METRICS_FAILURE_KEY, sample_rate=1.0)
            return render_error_page(request, status=400, body_text="HTTP 400: Invalid parameters")

        logger_params = asdict(unlink_team_request)
        logger_params["user_id"] = request.user.id

        integration = integration_service.get_integration(
            integration_id=unlink_team_request.integration_id
        )
        if not integration:
            _logger.info("no-integration-found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_integration", sample_rate=1.0)
            return render_error_page(
                request, status=404, body_text="HTTP 404: Could not find the Slack integration."
            )

        om = OrganizationMember.objects.get_for_integration(
            integration, request.user, organization_id=unlink_team_request.organization_id
        ).first()
        organization = om.organization if om else None
        if organization is None:
            _logger.info("no-organization-found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_organization", sample_rate=1.0)
            return render_error_page(
                request, status=404, body_text="HTTP 404: Could not find the organization."
            )

        channel_name = unlink_team_request.channel_name
        channel_id = unlink_team_request.channel_id

        external_teams = ExternalActor.objects.filter(
            organization_id=organization.id,
            integration_id=integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name=channel_name,
            external_id=channel_id,
        )
        if len(external_teams) == 0:
            _logger.info(
                "no-team-found",
                extra=logger_params,
            )
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_team", sample_rate=1.0)
            return render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        team = external_teams[0].team
        if team is None:
            _logger.info(
                "no-team-found",
                extra=logger_params,
            )
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_team", sample_rate=1.0)
            return render_error_page(request, status=404, body_text="HTTP 404: Team not found")

        logger_params["team_id"] = team.id

        # Error if you don't have a sufficient role and you're not a team admin
        # on the team you're trying to unlink.
        if not is_valid_role(om) and not is_team_admin(om, team=team):
            _logger.info(
                "invalid-role",
                extra=logger_params,
            )
            metrics.incr(self._METRICS_FAILURE_KEY + ".invalid_role", sample_rate=1.0)
            return render_error_page(
                request, status=403, body_text="HTTP 403: " + INSUFFICIENT_ACCESS
            )

        if request.method == "GET":
            return render_to_response(
                "sentry/integrations/slack/unlink-team.html",
                request=request,
                context={
                    "team": team,
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        idp = identity_service.get_provider(
            provider_ext_id=integration.external_id,
            provider_type=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
        )

        if not idp or not identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": unlink_team_request.slack_id}
        ):
            _logger.info("identity-not-found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".identity_not_found", sample_rate=1.0)
            return render_error_page(
                request, status=403, body_text="HTTP 403: User identity does not exist"
            )

        # Someone may have accidentally added multiple teams so unlink them all.
        for external_team in external_teams:
            external_team.delete()

        metrics.incr(self._METRICS_SUCCESS_KEY + "post.unlink_team", sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/unlinked-team.html",
            request=request,
            context={
                "heading_text": SUCCESS_UNLINKED_TEAM_TITLE,
                "body_text": SUCCESS_UNLINKED_TEAM_MESSAGE.format(team=team.slug),
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )
