from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_agentic_onboarding import (
    AgenticOnboardingPermission,
    enqueue_onboarding_progress,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.agentic_onboarding import (
    AgenticOnboardingRunSerializer,
)
from sentry.conduit.api import add_conduit_response_headers
from sentry.models.organization import Organization
from sentry.onboarding.agentic_progress.model import OnboardingRunTerminal
from sentry.onboarding.agentic_progress.service import (
    RunNotFound,
    get_onboarding_progress_service,
)


@cell_silo_endpoint
class OrganizationAgenticOnboardingRunDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (AgenticOnboardingPermission,)
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "DELETE": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.VALUE_DISCOVERY

    @extend_schema(responses={200: AgenticOnboardingRunSerializer})
    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        user_id = request.user.id
        assert user_id is not None
        run = get_onboarding_progress_service().get(
            run_id=run_id, user_id=user_id, organization_id=organization.id
        )
        if run is None:
            return Response({"detail": "Onboarding run not found"}, status=404)

        response = Response(
            serialize(
                run,
                request.user,
                AgenticOnboardingRunSerializer(),
            )
        )
        add_conduit_response_headers(response, organization.id, channel_id=run.channel_id)
        return response

    @extend_schema(responses={200: AgenticOnboardingRunSerializer})
    def delete(self, request: Request, organization: Organization, run_id: str) -> Response:
        user_id = request.user.id
        assert user_id is not None
        try:
            run, changed = get_onboarding_progress_service().cancel(
                run_id=run_id, user_id=user_id, organization_id=organization.id
            )
        except RunNotFound:
            return Response({"detail": "Onboarding run not found"}, status=404)
        except OnboardingRunTerminal:
            return Response({"detail": "Onboarding run is terminal"}, status=409)

        snapshot = serialize(run, request.user, AgenticOnboardingRunSerializer())
        if changed:
            enqueue_onboarding_progress(organization.id, run, snapshot)
        return Response(snapshot)
