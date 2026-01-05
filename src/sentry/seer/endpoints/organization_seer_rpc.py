import logging
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import NotFound, ParseError, PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.replays.usecases.summarize import rpc_get_replay_summary_logs
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
from sentry.seer.assisted_query.traces_tools import (
    get_attribute_names,
    get_attribute_values_with_substring,
)
from sentry.seer.autofix.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.endpoints.seer_rpc import (
    get_attributes_and_values,
    get_attributes_for_span,
    get_organization_features,
    get_organization_options,
    get_organization_project_ids,
    get_organization_slug,
    get_spans,
)
from sentry.seer.endpoints.utils import accept_organization_id_param, map_org_id_param
from sentry.seer.explorer.index_data import (
    rpc_get_issues_for_transaction,
    rpc_get_profiles_for_trace,
    rpc_get_trace_for_transaction,
    rpc_get_transactions_for_project,
)
from sentry.seer.explorer.tools import (
    execute_table_query,
    execute_timeseries_query,
    execute_trace_table_query,
    get_issue_and_event_details_v2,
    get_log_attributes_for_trace,
    get_metric_attributes_for_trace,
    get_replay_metadata,
    get_repository_definition,
    get_trace_item_attributes,
    rpc_get_profile_flamegraph,
    rpc_get_trace_waterfall,
)
from sentry.seer.fetch_issues import by_error_type, by_function_name, by_text_query, utils
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


# Registry of read-only telemetry methods that are safe to expose
# to organization members for local agent development
# These methods support organization-level or cross-project access
#
# Parameter conventions:
# - `organization_id` (int): Organization ID, auto-injected and validated. use map_org_id_param to map to `org_id` if needed.
public_org_seer_method_registry: dict[str, Callable] = {
    # Common to Seer features
    "get_organization_project_ids": map_org_id_param(get_organization_project_ids),
    "get_organization_slug": map_org_id_param(get_organization_slug),
    "get_organization_options": map_org_id_param(get_organization_options),
    "get_organization_features": map_org_id_param(get_organization_features),
    #
    # Bug prediction
    "get_issues_by_function_name": by_function_name.fetch_issues,
    "get_issues_related_to_exception_type": by_error_type.fetch_issues,
    "get_issues_by_raw_query": by_text_query.fetch_issues,
    "get_latest_issue_event": utils.get_latest_issue_event,
    #
    # Assisted query (cross-project)
    "get_attribute_names": map_org_id_param(get_attribute_names),
    "get_attribute_values_with_substring": map_org_id_param(get_attribute_values_with_substring),
    "get_attributes_and_values": map_org_id_param(get_attributes_and_values),
    "get_spans": map_org_id_param(get_spans),
    "get_event_filter_keys": map_org_id_param(get_event_filter_keys),
    "get_event_filter_key_values": map_org_id_param(get_event_filter_key_values),
    "get_issue_filter_keys": map_org_id_param(get_issue_filter_keys),
    "get_filter_key_values": map_org_id_param(get_filter_key_values),
    #
    # Explorer (cross-project)
    "get_trace_waterfall": rpc_get_trace_waterfall,
    "get_repository_definition": get_repository_definition,
    "execute_table_query": map_org_id_param(execute_table_query),
    "execute_timeseries_query": map_org_id_param(execute_timeseries_query),
    "execute_trace_table_query": execute_trace_table_query,
    "execute_issues_query": map_org_id_param(execute_issues_query),
    "get_issue_and_event_details_v2": get_issue_and_event_details_v2,
    "get_profile_flamegraph": rpc_get_profile_flamegraph,
    "get_replay_metadata": get_replay_metadata,
    "get_log_attributes_for_trace": map_org_id_param(get_log_attributes_for_trace),
    "get_metric_attributes_for_trace": map_org_id_param(get_metric_attributes_for_trace),
    "get_issues_stats": map_org_id_param(get_issues_stats),
}


# Registry of read-only telemetry methods that require project-level access
# These methods require a `project_id` parameter in the request args
#
# Parameter conventions:
# - `organization_id` (int): Organization ID, auto-injected and validated
# - `project_id` (int): Project ID, must be provided in request args and validated
public_project_seer_method_registry: dict[str, Callable] = {
    # Explorer - project-scoped methods
    "get_transactions_for_project": accept_organization_id_param(rpc_get_transactions_for_project),
    "get_trace_for_transaction": accept_organization_id_param(rpc_get_trace_for_transaction),
    "get_profiles_for_trace": accept_organization_id_param(rpc_get_profiles_for_trace),
    "get_issues_for_transaction": accept_organization_id_param(rpc_get_issues_for_transaction),
    # Autofix - project-scoped methods
    "get_error_event_details": accept_organization_id_param(get_error_event_details),
    "get_profile_details": get_profile_details,
    "get_attributes_for_span": map_org_id_param(get_attributes_for_span),
    "get_trace_item_attributes": map_org_id_param(get_trace_item_attributes),
    # Replays - project-scoped methods
    "get_replay_summary_logs": accept_organization_id_param(rpc_get_replay_summary_logs),
}


class SeerRpcPermission(OrganizationPermission):
    # Seer RPCs uses POST requests but is actually read only
    # So relax the permissions here.
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@region_silo_endpoint
class OrganizationSeerRpcEndpoint(OrganizationEndpoint):
    """
    Public RPC endpoint for organization members to call read-only seer methods.

    This endpoint supports both organization-level and project-level methods:
    - Organization-level methods: Require only organization membership
    - Project-level methods: Require `project_id` in request args for project access validation

    Parameter conventions:
    - `organization_id` (int): Organization ID, auto-injected and validated
    - `project_id` (int): For project-scoped methods, must be provided in request args
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
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

        # Check if user has access to the project
        if not request.access.has_project_access(project):
            raise PermissionDenied("You do not have access to this project")

        return project

    @sentry_sdk.trace
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
            method = public_org_seer_method_registry[method_name]
            arguments["organization_id"] = organization.id
            return method(**arguments)

        # Check if this is a project-level method
        if method_name in public_project_seer_method_registry:
            # Validate project access
            project_id = arguments.pop("project_id", None)
            if project_id is None:
                raise ParseError("project_id is required for this method")
            project = self._validate_project_access(request, organization, project_id)

            method = public_project_seer_method_registry[method_name]
            return method(
                **arguments,
                organization_id=organization.id,
                project_id=project.id,
            )

        raise RpcResolutionException(f"Unknown method {method_name}")

    @sentry_sdk.trace
    def post(self, request: Request, organization: Organization, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)

        if not self._is_allowed(organization):
            raise NotFound()

        try:
            arguments: dict[str, Any] = request.data.get("args", {})
        except (KeyError, AttributeError) as e:
            raise ParseError from e

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
        except Exception as e:
            if in_test_environment():
                raise
            sentry_sdk.capture_exception()
            raise ValidationError from e

        return Response(data=result)
