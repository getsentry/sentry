import re
from datetime import timedelta
from uuid import UUID

from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.exceptions import DataSecrecyError, SuperuserRequired
from sentry.api.permissions import SuperuserPermission
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.data_secrecy.logic import should_allow_superuser_access
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.auth import is_user_from_viewer_context
from sentry.utils.snuba import SnubaError
from sentry.workflow_engine.debug import query_debugger_artifacts, resolve_debugger_context
from sentry.workflow_engine.processors.evaluations.eap import EAP_RETENTION_DAYS

MAX_ID = (1 << 63) - 1
STATS_PERIODS = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
ITEM_TYPES = frozenset({"workflow", "detector", "group", "event"})
QUERY_PARAMETERS = frozenset({"type", "id", "projectId", "statsPeriod"})
EVENT_ID_PATTERN = re.compile(
    r"(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)


class WorkflowDebuggerPermission(SuperuserPermission):
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


def _positive_id(value: str | None, parameter: str) -> int:
    if value is None or not re.fullmatch(r"[0-9]{1,19}", value):
        raise ParseError(f"{parameter} must be a positive integer no greater than {MAX_ID}.")
    parsed = int(value)
    if not 0 < parsed <= MAX_ID:
        raise ParseError(f"{parameter} must be a positive integer no greater than {MAX_ID}.")
    return parsed


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
class AdminWorkflowDebuggerEndpoint(Endpoint):
    """Read current configuration and sampled workflow-engine evaluation artifacts.

    GET accepts type=workflow|detector|group|event, id, an event-only projectId,
    and statsPeriod=1h|24h|7d (default 24h). The selected cell serves the lookup.
    Only elevated, non-impersonated browser superusers with organization access
    can read the result.
    Returns item, artifacts, start, end, retentionDays, and truncated. Artifacts
    have seven-day retention and best-effort emission: an empty result does not
    prove that the item was never evaluated. This endpoint performs no writes.
    """

    owner = ApiOwner.ALERTS_MONITORS
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (WorkflowDebuggerPermission,)
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, cell_id: str) -> Response:
        params = request.query_params
        if set(params) - QUERY_PARAMETERS:
            raise ParseError("Only type, id, projectId, and statsPeriod are supported.")
        if any(len(params.getlist(key)) != 1 for key in params):
            raise ParseError("Each query parameter must have exactly one value.")

        item_type = params.get("type", "")
        if item_type not in ITEM_TYPES:
            raise ParseError("type must be workflow, detector, group, or event.")
        stats_period = params.get("statsPeriod", "24h")
        if stats_period not in STATS_PERIODS:
            raise ParseError("statsPeriod must be 1h, 24h, or 7d.")

        project_id = None
        if item_type == "event":
            project_id = _positive_id(params.get("projectId"), "projectId")
            raw_id = params.get("id", "")
            if not EVENT_ID_PATTERN.fullmatch(raw_id):
                raise ParseError("id must be a 32-character hexadecimal event ID or UUID.")
            item_id = UUID(raw_id).hex
        else:
            if "projectId" in params:
                raise ParseError("projectId is only supported for event searches.")
            item_id = str(_positive_id(params.get("id"), "id"))

        if project_id is not None:
            # Event resolution itself can query Snuba. Authorize the owning
            # organization before accessing eventstore, not just artifacts.
            try:
                project = Project.objects.select_related("organization").get(id=project_id)
            except Project.DoesNotExist as error:
                raise Http404("Project not found.") from error
            _authorize_organization(request, project.organization)

        try:
            context = resolve_debugger_context(item_type, item_id, project_id)
            _authorize_organization(request, context.organization)
            end = timezone.now()
            start = end - STATS_PERIODS[stats_period]
            result = query_debugger_artifacts(context, start=start, end=end)
        except SnubaError:
            return Response(
                {"detail": "Could not query workflow-engine evaluations. Try again later."},
                status=503,
            )

        return Response(
            {
                "item": context.item,
                "artifacts": result.artifacts,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "retentionDays": EAP_RETENTION_DAYS,
                "truncated": result.truncated,
            },
            headers={"Cache-Control": "no-store"},
        )
