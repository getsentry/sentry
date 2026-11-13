from django.http import Http404
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.exceptions import DataSecrecyError, SuperuserRequired
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.event import SimpleEventSerializer
from sentry.api.serializers.models.group import SimpleGroupSerializer
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.data_secrecy.logic import should_allow_superuser_access
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.auth import is_user_from_viewer_context
from sentry.utils.snuba import SnubaError
from sentry.workflow_engine.artifacts import (
    ArtifactItemType,
    query_artifacts,
    resolve_artifact_target,
)
from sentry.workflow_engine.endpoints.serializers.detector_serializer import DetectorSerializer
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import WorkflowSerializer
from sentry.workflow_engine.endpoints.validators.workflow_engine_artifacts import (
    STATS_PERIODS,
    WorkflowEngineArtifactsQueryValidator,
)
from sentry.workflow_engine.processors.evaluations.eap import EAP_RETENTION_DAYS

ITEM_SERIALIZERS: dict[ArtifactItemType, type[Serializer]] = {
    "workflow": WorkflowSerializer,
    "detector": DetectorSerializer,
    "group": SimpleGroupSerializer,
    "event": SimpleEventSerializer,
}


class WorkflowEngineArtifactsPermission(SuperuserPermission):
    """Require an elevated browser session, never a delegated or impersonated identity."""

    def has_permission(self, request: Request, view: object) -> bool:
        if (
            request.auth is not None
            or request.META.get("HTTP_AUTHORIZATION")
            or getattr(request, "actual_user", None) is not None
            or is_user_from_viewer_context(request)
        ):
            return False
        return super().has_permission(request, view)


def _authorize_organization(request: Request, organization: Organization) -> None:
    # SuperuserMiddleware binds elevation to the underlying HttpRequest. Setting
    # its organization activates the shorter cross-organization session expiry.
    request._request.organization = organization
    if not should_allow_superuser_access(organization):
        raise DataSecrecyError(message="Superuser access is disabled for this organization.")
    if not is_active_superuser(request):
        raise SuperuserRequired()
    superuser = getattr(request, "superuser", None) or Superuser(request._request)
    if superuser.requires_org_auth(organization):
        raise SuperuserRequired(orgSlug=organization.slug)


@internal_cell_silo_endpoint
class AdminWorkflowEngineArtifactsEndpoint(Endpoint):
    """Read current configuration and sampled workflow-engine evaluation artifacts.

    Requests go directly to the cell that owns the item (the caller picks the host).
    Artifacts have seven-day retention and best-effort emission: an empty result
    does not prove that the item was never evaluated.
    """

    owner = ApiOwner.ALERTS_MONITORS
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (WorkflowEngineArtifactsPermission,)
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request) -> Response:
        validator = WorkflowEngineArtifactsQueryValidator(data=request.query_params)
        validator.is_valid(raise_exception=True)
        item_type = validator.validated_data["type"]
        item_id = validator.validated_data["id"]
        project_id = validator.validated_data.get("projectId")

        project = None
        if project_id is not None:
            # Event resolution itself can query Snuba. Authorize the owning
            # organization before accessing eventstore, not just artifacts.
            try:
                project = Project.objects.select_related("organization").get(id=project_id)
            except Project.DoesNotExist as error:
                raise Http404("Project not found.") from error
            _authorize_organization(request, project.organization)

        try:
            target = resolve_artifact_target(item_type, item_id, project)
            _authorize_organization(request, target.organization)
            item = serialize(target.instance, request.user, ITEM_SERIALIZERS[target.type]())
            end = timezone.now()
            start = end - STATS_PERIODS[validator.validated_data["statsPeriod"]]
            result = query_artifacts(target, start=start, end=end)
        except SnubaError:
            return Response(
                {"detail": "Could not query workflow-engine evaluations. Try again later."},
                status=503,
            )

        return Response(
            {
                "item": {
                    "type": target.type,
                    "id": target.id,
                    "organizationId": str(target.organization.id),
                    "data": item,
                },
                "artifacts": result.artifacts,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "retentionDays": EAP_RETENTION_DAYS,
                "truncated": result.truncated,
            },
            headers={"Cache-Control": "no-store"},
        )
