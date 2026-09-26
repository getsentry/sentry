import logging
from typing import Any

import sentry_sdk
from django.core.exceptions import ObjectDoesNotExist
from pydantic import BaseModel
from rest_framework.exceptions import NotFound, ParseError, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.hybridcloud.rpc.service import RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team, TeamStatus
from sentry.replays.usecases.summarize import rpc_get_replay_summary_logs
from sentry.seer.agent.index_data import (
    rpc_get_issues_for_transaction,
    rpc_get_profiles_for_trace,
    rpc_get_trace_for_transaction,
    rpc_get_transactions_for_project,
)
from sentry.seer.agent.snapshot_indexes import export_agent_indexes
from sentry.seer.agent.tools import (
    execute_table_query,
    execute_timeseries_query,
    execute_trace_table_query,
    get_baseline_tag_distribution,
    get_dsn,
    get_event_details,
    get_issue_committers,
    get_issue_details,
    get_issue_ownership,
    get_log_attributes_for_trace,
    get_metric_attributes_for_trace,
    get_replay_metadata,
    get_repository_definition,
    get_team_members,
    rpc_get_profile_flamegraph,
    rpc_get_trace_waterfall,
)
from sentry.seer.assisted_query.discover_tools import (
    get_event_filter_key_values,
    get_event_filter_keys,
)
from sentry.seer.assisted_query.issues_tools import (
    execute_issues_query,
    get_filter_key_values,
    get_issue_filter_keys,
    get_issues_stats,
)
from sentry.seer.assisted_query.metrics_tools import get_metric_metadata
from sentry.seer.assisted_query.traces_tools import (
    get_attribute_names,
    get_attribute_values_with_substring,
)
from sentry.seer.autofix.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.endpoints.registry import SeerRpcMethod, seer_rpc
from sentry.seer.endpoints.seer_rpc import (
    get_attributes_and_values,
    get_attributes_for_span,
    get_github_enterprise_integration_config,
    get_organization_features,
    get_organization_projects,
    get_organization_slug,
    has_repo_code_mappings,
)
from sentry.seer.endpoints.utils import accept_organization_id_param, map_org_id_param
from sentry.seer.fetch_issues import by_error_type, by_function_name, by_text_query, utils
from sentry.utils import metrics
from sentry.utils.env import in_test_environment
from sentry.utils.tracing import trace
from sentry.viewer_context import get_viewer_context, observe_viewer_context_propagation

logger = logging.getLogger(__name__)


# Every value in the registries below MUST be a function returning a
# `pydantic.BaseModel` (or a union of `BaseModel` subclasses, optionally with
# `None`). Two complementary guards enforce this:
#   1. The `dict[str, SeerRpcMethod]` annotation rejects `dict` /
#      `dict[str, Any]` / generic `Callable` returns at type-check time.
#   2. Wrapping each value with `seer_rpc(...)` triggers the custom mypy plugin
#      (`tools.mypy_helpers.plugin._check_seer_rpc_handler_not_any`) to walk
#      the registered function's return type and reject any `Any`. Without
#      this, `-> Any` would slip past the structural check because `Any` is
#      bidirectionally compatible with everything.
# To add a method, define a Pydantic response model in
# `sentry.seer.sentry_data_models`, annotate the handler with it, and register
# the handler as `"name": seer_rpc(handler)`.


# Registry of read-only organization and cross-project telemetry methods for
# local agent development. ``_dispatch_to_local_method`` applies method-specific
# authorization before invoking any handler.
#
# Parameter conventions:
# - `organization_id` (int): Organization ID, auto-injected and validated. use map_org_id_param to map to `org_id` if needed.
public_org_seer_method_registry: dict[str, SeerRpcMethod] = {
    # Common to Seer features
    "get_organization_projects": seer_rpc(map_org_id_param(get_organization_projects)),
    "get_organization_slug": seer_rpc(map_org_id_param(get_organization_slug)),
    "get_organization_features": seer_rpc(map_org_id_param(get_organization_features)),
    "get_github_enterprise_integration_config": seer_rpc(get_github_enterprise_integration_config),
    #
    # Bug prediction
    "has_repo_code_mappings": seer_rpc(has_repo_code_mappings),
    "get_issues_by_function_name": seer_rpc(by_function_name.fetch_issues),
    "get_issues_related_to_exception_type": seer_rpc(by_error_type.fetch_issues),
    "get_issues_by_raw_query": seer_rpc(by_text_query.fetch_issues),
    "get_latest_issue_event": seer_rpc(utils.get_latest_issue_event),
    #
    # Assisted query (cross-project)
    "get_attribute_names": seer_rpc(map_org_id_param(get_attribute_names)),
    "get_attribute_values_with_substring": seer_rpc(
        map_org_id_param(get_attribute_values_with_substring)
    ),
    "get_attributes_and_values": seer_rpc(map_org_id_param(get_attributes_and_values)),
    "get_metric_metadata": seer_rpc(map_org_id_param(get_metric_metadata)),
    "get_event_filter_keys": seer_rpc(map_org_id_param(get_event_filter_keys)),
    "get_event_filter_key_values": seer_rpc(map_org_id_param(get_event_filter_key_values)),
    "get_issue_filter_keys": seer_rpc(map_org_id_param(get_issue_filter_keys)),
    "get_filter_key_values": seer_rpc(map_org_id_param(get_filter_key_values)),
    #
    # Agent (cross-project)
    "get_trace_waterfall": seer_rpc(rpc_get_trace_waterfall),
    "get_repository_definition": seer_rpc(get_repository_definition),
    "execute_table_query": seer_rpc(map_org_id_param(execute_table_query)),
    "execute_timeseries_query": seer_rpc(map_org_id_param(execute_timeseries_query)),
    "execute_trace_table_query": seer_rpc(execute_trace_table_query),
    "execute_issues_query": seer_rpc(map_org_id_param(execute_issues_query)),
    "get_issue_details": seer_rpc(get_issue_details),
    "get_issue_committers": seer_rpc(get_issue_committers),
    "get_issue_ownership": seer_rpc(get_issue_ownership),
    "get_team_members": seer_rpc(get_team_members),
    "get_event_details": seer_rpc(get_event_details),
    "get_profile_flamegraph": seer_rpc(rpc_get_profile_flamegraph),
    "get_replay_metadata": seer_rpc(get_replay_metadata),
    "get_log_attributes_for_trace": seer_rpc(map_org_id_param(get_log_attributes_for_trace)),
    "get_metric_attributes_for_trace": seer_rpc(map_org_id_param(get_metric_attributes_for_trace)),
    "get_issues_stats": seer_rpc(map_org_id_param(get_issues_stats)),
    "get_dsn": seer_rpc(get_dsn),
    #
    # Agent eval tooling
    "export_explorer_indexes": seer_rpc(map_org_id_param(export_agent_indexes)),
}


# Registry of read-only telemetry methods that require project-level access
# These methods require a `project_id` parameter in the request args
#
# Parameter conventions:
# - `organization_id` (int): Organization ID, auto-injected and validated
# - `project_id` (int): Project ID, must be provided in request args and validated
public_project_seer_method_registry: dict[str, SeerRpcMethod] = {
    # Agent - project-scoped methods
    "get_transactions_for_project": seer_rpc(
        accept_organization_id_param(rpc_get_transactions_for_project)
    ),
    "get_trace_for_transaction": seer_rpc(
        accept_organization_id_param(rpc_get_trace_for_transaction)
    ),
    "get_profiles_for_trace": seer_rpc(accept_organization_id_param(rpc_get_profiles_for_trace)),
    "get_issues_for_transaction": seer_rpc(
        accept_organization_id_param(rpc_get_issues_for_transaction)
    ),
    # Autofix - project-scoped methods
    "get_error_event_details": seer_rpc(accept_organization_id_param(get_error_event_details)),
    "get_profile_details": seer_rpc(get_profile_details),
    "get_attributes_for_span": seer_rpc(map_org_id_param(get_attributes_for_span)),
    # Replays - project-scoped methods
    "get_replay_summary_logs": seer_rpc(accept_organization_id_param(rpc_get_replay_summary_logs)),
    # Suspect attributes - project-scoped methods
    "get_baseline_tag_distribution": seer_rpc(get_baseline_tag_distribution),
}


# These methods return organization metadata and do not read project-backed data.
_ORGANIZATION_METADATA_METHODS: frozenset[str] = frozenset(
    {
        "get_organization_features",
        "get_organization_slug",
    }
)


# Methods whose project selection can be constrained before dispatch. The tuple
# records which argument names each handler accepts. When the caller omits a
# selection, the endpoint injects the projects they can read instead of allowing
# the handler to fall back to the organization-wide ALL_ACCESS_PROJECT_ID.
_PROJECT_SELECTION_METHODS: dict[str, tuple[str, ...]] = {
    "get_attribute_names": ("project_ids",),
    "get_attribute_values_with_substring": ("project_ids",),
    "get_attributes_and_values": ("project_ids",),
    "get_metric_metadata": ("project_ids",),
    "get_event_filter_keys": ("project_ids",),
    "get_event_filter_key_values": ("project_ids",),
    "get_issue_filter_keys": ("project_ids",),
    "get_filter_key_values": ("project_ids",),
    "execute_table_query": ("project_ids", "project_slugs"),
    "execute_timeseries_query": ("project_ids", "project_slugs"),
    "execute_trace_table_query": ("project_ids", "project_slugs"),
    "execute_issues_query": ("project_ids",),
    "get_log_attributes_for_trace": ("project_slugs",),
    "get_metric_attributes_for_trace": ("project_slugs",),
    "get_issues_stats": ("project_ids",),
}

# Org-level methods keyed by ``issue_id``/``event_id`` whose responses are
# project-scoped (commit messages, PR titles/bodies/URLs, author emails, full event
# payloads, issue details). These methods are authorized against the resolved issue
# before dispatch and retain a defense-in-depth result check. A caller without access
# gets the same response as a missing issue (``None``), matching the existing contract.
_issue_scoped_org_methods: frozenset[str] = frozenset(
    {
        "get_issue_committers",
        "get_issue_ownership",
        "get_issue_details",
        "get_event_details",
        "get_latest_issue_event",
    }
)


class SeerRpcPermission(OrganizationPermission):
    # Seer RPCs uses POST requests but is actually read only
    # So relax the permissions here.
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


def _serialize_result(result: Any) -> Any:
    """Convert Pydantic returns to dict so DRF's JSONRenderer can serialize."""
    if isinstance(result, BaseModel):
        return result.dict()
    return result


@cell_silo_endpoint
class OrganizationSeerRpcEndpoint(OrganizationEndpoint):
    """
    Public RPC endpoint for organization members to call read-only seer methods.

    This endpoint supports organization-level and project-level methods:
    - Organization metadata methods require organization membership.
    - Project-selectable methods are constrained to projects the caller can read.
    - Issue, team, and single-project methods validate their resolved resources.
    - Methods that cannot be safely narrowed require global project access.

    Parameter conventions:
    - `organization_id` (int): Organization ID, auto-injected and validated
    - `project_id` (int): For project-scoped methods, must be provided in request args
    """

    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = False
    permission_classes = (SeerRpcPermission,)

    def _is_allowed(self, organization: Organization) -> bool:
        """Check if the organization is allowed to use this endpoint."""
        return features.has("organizations:seer-public-rpc", organization)

    def _validate_project_access(
        self, request: Request, organization: Organization, project_id: int
    ) -> Project:
        """Validate that the project exists, belongs to the org, and user has access."""
        try:
            project = Project.objects.get(
                id=project_id,
                organization=organization,
                status=ObjectStatus.ACTIVE,
            )
        except Project.DoesNotExist:
            raise NotFound("Project not found")

        # Use the same response for missing and inaccessible projects so callers
        # cannot use this endpoint to enumerate private projects.
        if not request.access.has_project_access(project):
            raise NotFound("Project not found")

        return project

    def _validate_project_slug_access(
        self, request: Request, organization: Organization, project_slug: str
    ) -> Project:
        project = Project.objects.filter(
            slug=project_slug,
            organization=organization,
            status=ObjectStatus.ACTIVE,
        ).first()
        if project is None:
            raise NotFound("Project not found")

        # Use the same response for missing and inaccessible projects so callers
        # cannot use this endpoint to enumerate private projects.
        if not request.access.has_project_access(project):
            raise NotFound("Project not found")

        return project

    def _require_global_project_access(self, request: Request) -> None:
        if not request.access.has_global_access:
            raise PermissionDenied("You do not have access to all projects in this organization")

    def _get_authorized_projects(
        self,
        request: Request,
        organization: Organization,
        *,
        project_ids: Any = None,
        project_slugs: Any = None,
    ) -> list[Project]:
        parsed_ids: set[int] | None = None
        if project_ids is not None and project_ids != []:
            if not isinstance(project_ids, list) or any(
                isinstance(project_id, bool) for project_id in project_ids
            ):
                raise ParseError("project_ids must be a list of integers")
            try:
                parsed_ids = {int(project_id) for project_id in project_ids}
            except (TypeError, ValueError):
                raise ParseError("project_ids must be a list of integers") from None

        parsed_slugs: set[str] | None = None
        if project_slugs is not None and project_slugs != []:
            if not isinstance(project_slugs, list) or not all(
                isinstance(project_slug, str) and project_slug for project_slug in project_slugs
            ):
                raise ParseError("project_slugs must be a list of non-empty strings")
            parsed_slugs = set(project_slugs)

        if parsed_ids and parsed_slugs:
            raise ParseError("project_ids and project_slugs cannot both be provided")

        selection_is_explicit = parsed_ids is not None or parsed_slugs is not None
        if not selection_is_explicit:
            # Supplying the all-projects sentinel keeps this JSON-RPC endpoint from
            # falling back to project selection in the URL query string.
            parsed_ids = {ALL_ACCESS_PROJECT_ID}
        projects = self.get_projects(
            request,
            organization,
            include_all_accessible=not selection_is_explicit,
            project_ids=parsed_ids,
            project_slugs=parsed_slugs,
        )
        return projects

    def _authorize_project_selection(
        self,
        request: Request,
        organization: Organization,
        method_name: str,
        arguments: dict[str, Any],
    ) -> None:
        supported_arguments = _PROJECT_SELECTION_METHODS[method_name]
        project_ids = arguments.get("project_ids") if "project_ids" in supported_arguments else None
        project_slugs = (
            arguments.get("project_slugs") if "project_slugs" in supported_arguments else None
        )
        projects = self._get_authorized_projects(
            request,
            organization,
            project_ids=project_ids,
            project_slugs=project_slugs,
        )
        if not projects:
            raise PermissionDenied("You do not have access to any projects in this organization")

        if project_ids:
            arguments["project_ids"] = [project.id for project in projects]
        elif project_slugs:
            arguments["project_slugs"] = [project.slug for project in projects]
        elif "project_ids" in supported_arguments:
            arguments["project_ids"] = [project.id for project in projects]
        else:
            arguments["project_slugs"] = [project.slug for project in projects]

    def _resolve_issue_project(
        self,
        organization: Organization,
        issue_id: Any,
        project_slug: Any = None,
    ) -> Project | None:
        if project_slug is not None and not isinstance(project_slug, str):
            raise ParseError("project_slug must be a string")

        issue_id_str = str(issue_id)
        project_filter = {
            "organization_id": organization.id,
            "status": ObjectStatus.ACTIVE,
            **({"slug": project_slug} if project_slug else {}),
        }
        if issue_id_str.isdigit():
            group = (
                Group.objects.filter(
                    id=int(issue_id_str),
                    project__organization_id=organization.id,
                    project__status=ObjectStatus.ACTIVE,
                    **({"project__slug": project_slug} if project_slug else {}),
                )
                .select_related("project")
                .first()
            )
        else:
            project_ids = list(
                Project.objects.filter(**project_filter).values_list("id", flat=True)
            )
            if not project_ids:
                return None
            try:
                group = Group.objects.by_qualified_short_id(
                    organization.id,
                    issue_id_str,
                    project_ids=project_ids,
                )
            except Group.DoesNotExist:
                return None

        return group.project if group is not None else None

    def _authorize_issue_scoped_method(
        self,
        request: Request,
        organization: Organization,
        method_name: str,
        arguments: dict[str, Any],
    ) -> bool:
        issue_id = arguments.get("issue_id") or arguments.get("group_id")

        if issue_id is None:
            if method_name != "get_event_details":
                raise ParseError("issue_id is required")

            project_slug = arguments.get("project_slug")
            if not project_slug:
                self._require_global_project_access(request)
                return True

            try:
                self._validate_project_slug_access(request, organization, project_slug)
            except (NotFound, PermissionDenied):
                metrics.incr(
                    "seer.org_rpc.issue_scoped_authz",
                    tags={"method": method_name, "outcome": "access_denied"},
                )
                return False
            return True

        project = self._resolve_issue_project(
            organization,
            issue_id,
            arguments.get("project_slug"),
        )
        if project is None:
            metrics.incr(
                "seer.org_rpc.issue_scoped_authz",
                tags={"method": method_name, "outcome": "not_found"},
            )
            return False
        if not request.access.has_project_access(project):
            metrics.incr(
                "seer.org_rpc.issue_scoped_authz",
                tags={"method": method_name, "outcome": "access_denied"},
            )
            return False
        return True

    def _filter_issue_scoped_result(self, request: Request, method_name: str, result: Any) -> Any:
        """Gate an issue/event-scoped result on access to its project.

        Issue-scoped dispatch already resolves and authorizes the issue's project. As
        defense in depth, collapse a mismatched result into ``None`` — the same signal
        these methods use for a missing issue.
        """
        if result is None:
            metrics.incr(
                "seer.org_rpc.issue_scoped_authz",
                tags={"method": method_name, "outcome": "not_found"},
            )
            return None

        project = Project.objects.get_from_cache(id=result.project_id)
        if not request.access.has_project_access(project):
            metrics.incr(
                "seer.org_rpc.issue_scoped_authz",
                tags={"method": method_name, "outcome": "access_denied"},
            )
            return None

        return result

    def _authorize_project_slug_method(
        self,
        request: Request,
        organization: Organization,
        arguments: dict[str, Any],
        *,
        required: bool,
    ) -> None:
        """Authorize a method that uses a single ``project_slug``.

        When *required* is ``True`` (e.g. ``get_dsn``), the slug must be present.
        When ``False`` (e.g. ``get_replay_metadata``), a missing slug falls back
        to requiring global project access.
        """
        project_slug = arguments.get("project_slug")
        if project_slug:
            if not isinstance(project_slug, str):
                raise ParseError("project_slug must be a string")
            project = self._validate_project_slug_access(request, organization, project_slug)
            arguments["project_slug"] = project.slug
        elif required:
            raise ParseError("project_slug is required for this method")
        else:
            self._require_global_project_access(request)

    def _authorize_team_access(
        self,
        request: Request,
        organization: Organization,
        arguments: dict[str, Any],
    ) -> None:
        """Authorize team-scoped methods like ``get_team_members``."""
        team_slug = arguments.get("team_slug")
        if not isinstance(team_slug, str) or not team_slug:
            raise ParseError("team_slug is required for this method")
        try:
            team = Team.objects.get(
                organization=organization,
                slug=team_slug,
                status=TeamStatus.ACTIVE,
            )
        except Team.DoesNotExist:
            raise NotFound("Team not found")
        if not request.access.has_team_scope(team, "team:read"):
            # Use the same response for missing and inaccessible teams.
            raise NotFound("Team not found")

    @trace
    def _dispatch_to_local_method(
        self,
        request: Request,
        method_name: str,
        arguments: dict[str, Any],
        organization: Organization,
    ) -> Any:
        arguments.pop("organization_id", None)

        # Check if this is an org-level method
        if method_name in public_org_seer_method_registry:
            authorized_project_ids: set[int] | None = None
            if method_name in _ORGANIZATION_METADATA_METHODS:
                pass
            elif method_name == "get_organization_projects":
                authorized_projects = self._get_authorized_projects(request, organization)
                authorized_project_ids = {project.id for project in authorized_projects}
            elif method_name in _PROJECT_SELECTION_METHODS:
                self._authorize_project_selection(request, organization, method_name, arguments)
            elif method_name in _issue_scoped_org_methods:
                if not self._authorize_issue_scoped_method(
                    request, organization, method_name, arguments
                ):
                    # get_latest_issue_event uses {} as its "not found" sentinel;
                    # every other issue-scoped method uses None.
                    return {} if method_name == "get_latest_issue_event" else None
            elif method_name == "get_dsn":
                self._authorize_project_slug_method(request, organization, arguments, required=True)
            elif method_name == "get_replay_metadata":
                self._authorize_project_slug_method(
                    request, organization, arguments, required=False
                )
            elif method_name == "get_team_members":
                self._authorize_team_access(request, organization, arguments)
            else:
                self._require_global_project_access(request)

            method = public_org_seer_method_registry[method_name]
            arguments["organization_id"] = organization.id
            result = method(**arguments)
            if method_name in _issue_scoped_org_methods and method_name != "get_latest_issue_event":
                result = self._filter_issue_scoped_result(request, method_name, result)
            serialized_result = _serialize_result(result)
            if authorized_project_ids is not None:
                serialized_result["projects"] = [
                    project
                    for project in serialized_result["projects"]
                    if project["id"] in authorized_project_ids
                ]
            return serialized_result

        # Check if this is a project-level method
        if method_name in public_project_seer_method_registry:
            # Validate project access
            project_id = arguments.pop("project_id", None)
            if project_id is None:
                raise ParseError("project_id is required for this method")
            if isinstance(project_id, bool):
                raise ParseError("project_id must be an integer")
            try:
                project_id = int(project_id)
            except (TypeError, ValueError):
                raise ParseError("project_id must be an integer") from None
            project = self._validate_project_access(request, organization, project_id)

            method = public_project_seer_method_registry[method_name]
            return _serialize_result(
                method(
                    **arguments,
                    organization_id=organization.id,
                    project_id=project.id,
                )
            )

        raise RpcResolutionException(f"Unknown method {method_name}")

    @trace
    def post(self, request: Request, organization: Organization, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)
        sentry_sdk.set_attribute("rpc.method", method_name)
        seer_referrer = request.headers.get("X-Seer-Referrer")
        if seer_referrer is not None:
            sentry_sdk.set_tag("rpc.referrer", seer_referrer)
            sentry_sdk.set_attribute("rpc.referrer", seer_referrer)

        # Observe whether the caller (seer) propagated X-Viewer-Context for this
        # method. ViewerContextMiddleware has already decoded the header into the
        # contextvar; we pass ctx=None explicitly when the header was absent so
        # the missing-VC signal fires (the middleware always falls back to an
        # empty-USER ctx, which would mask "header not sent").
        has_vc_header = bool(request.META.get("HTTP_X_VIEWER_CONTEXT"))
        observe_viewer_context_propagation(
            "org_seer_rpc_in",
            ctx=get_viewer_context() if has_vc_header else None,
            extra_attributes={"method": method_name},
        )

        if not self._is_allowed(organization):
            raise NotFound()

        try:
            arguments: dict[str, Any] = request.data.get("args", {})
        except (KeyError, AttributeError) as e:
            raise ParseError from e
        if not isinstance(arguments, dict):
            raise ParseError("args must be an object")

        try:
            result = self._dispatch_to_local_method(request, method_name, arguments, organization)
        except RpcResolutionException as e:
            sentry_sdk.capture_exception()
            raise NotFound from e
        except SerializableFunctionValueException as e:
            sentry_sdk.capture_exception()
            raise ParseError from e
        except ObjectDoesNotExist as e:
            # Let this fall through, this is normal.
            sentry_sdk.capture_exception()
            raise NotFound from e
        except (NotFound, ParseError, PermissionDenied):
            raise
        except Exception as e:
            if in_test_environment():
                raise
            sentry_sdk.capture_exception()
            raise ValidationError from e

        return Response(data=result)
