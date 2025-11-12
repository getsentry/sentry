import logging
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import NotFound, ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.hybridcloud.rpc.service import RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.organization import Organization
from sentry.seer.endpoints.seer_rpc import (
    get_attribute_names,
    get_attribute_values_with_substring,
    get_attributes_and_values,
    get_organization_project_ids,
    get_organization_slug,
    get_spans,
)
from sentry.seer.endpoints.utils import map_org_id_param
from sentry.seer.explorer.tools import (
    execute_trace_query_chart,
    execute_trace_query_table,
    get_issue_details,
    get_repository_definition,
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
public_seer_method_registry: dict[str, Callable] = {
    # Common to Seer features
    "get_organization_project_ids": map_org_id_param(get_organization_project_ids),
    "get_organization_slug": map_org_id_param(get_organization_slug),
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
    #
    # Explorer (cross-project)
    "get_trace_waterfall": rpc_get_trace_waterfall,
    "get_issue_details": get_issue_details,
    "execute_trace_query_chart": map_org_id_param(execute_trace_query_chart),
    "execute_trace_query_table": map_org_id_param(execute_trace_query_table),
    "get_repository_definition": get_repository_definition,
}


@region_silo_endpoint
class OrganizationSeerRpcEndpoint(OrganizationEndpoint):
    """
    Public RPC endpoint for organization members to call read-only seer methods
    that operate on organization-level or cross-project data.

    This endpoint enforces organization-level permissions. For methods that access
    multiple projects, it validates that all project IDs belong to the organization.

    For single-project methods with stricter project-level permissions,
    use ProjectSeerRpcEndpoint instead.

    Parameter conventions:
    - `organization_id` (int): Organization ID, auto-injected and validated. use map_org_id_param to map to `org_id` if needed.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = False

    @sentry_sdk.trace
    def _dispatch_to_local_method(
        self, method_name: str, arguments: dict[str, Any], organization: Organization
    ) -> Any:
        if method_name not in public_seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")

        method = public_seer_method_registry[method_name]

        arguments["organization_id"] = organization.id

        return method(**arguments)

    @sentry_sdk.trace
    def post(self, request: Request, organization: Organization, method_name: str) -> Response:
        try:
            arguments: dict[str, Any] = request.data.get("args", {})
        except (KeyError, AttributeError) as e:
            raise ParseError from e

        try:
            result = self._dispatch_to_local_method(method_name, arguments, organization)
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
