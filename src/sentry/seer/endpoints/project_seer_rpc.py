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
from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.hybridcloud.rpc.service import RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.project import Project
from sentry.replays.usecases.summarize import rpc_get_replay_summary_logs
from sentry.seer.autofix.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.endpoints.seer_rpc import get_attributes_for_span
from sentry.seer.endpoints.utils import accept_organization_id_param
from sentry.seer.explorer.index_data import (
    rpc_get_issues_for_transaction,
    rpc_get_profiles_for_trace,
    rpc_get_trace_for_transaction,
    rpc_get_transactions_for_project,
)
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


# Registry of read-only telemetry methods that are safe to expose
# to project members for local agent development
# These methods require single-project access and accept `project_id` parameter
# - `organization_id` (int): Organization ID, auto-injected and validated. use map_org_id_param to map to `org_id`, or remove_organization_id_param to remove it.
# - `project_id` (int): Project ID, auto-injected and validated.
project_seer_method_registry: dict[str, Callable] = {
    # Explorer - project-scoped methods
    "get_transactions_for_project": accept_organization_id_param(rpc_get_transactions_for_project),
    "get_trace_for_transaction": accept_organization_id_param(rpc_get_trace_for_transaction),
    "get_profiles_for_trace": accept_organization_id_param(rpc_get_profiles_for_trace),
    "get_issues_for_transaction": accept_organization_id_param(rpc_get_issues_for_transaction),
    # Autofix - project-scoped methods
    "get_error_event_details": accept_organization_id_param(get_error_event_details),
    "get_profile_details": get_profile_details,
    "get_attributes_for_span": get_attributes_for_span,
    # Replays - project-scoped methods
    "get_replay_summary_logs": accept_organization_id_param(rpc_get_replay_summary_logs),
}


@region_silo_endpoint
class ProjectSeerRpcEndpoint(ProjectEndpoint):
    """
    Public RPC endpoint for project members to call read-only seer methods
    that operate on single-project data.

    This endpoint enforces project-level permissions (ProjectEventPermission),
    which is more restrictive than organization-level access. Users must have
    access to the specific project to call methods through this endpoint.

    For cross-project or organization-level methods, use OrganizationSeerRpcEndpoint.

    Parameter conventions:
    - `project_id` (int): Single project ID, auto-injected from URL context
    """

    permission_classes = (ProjectEventPermission,)
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = False

    @sentry_sdk.trace
    def _dispatch_to_local_method(
        self, method_name: str, arguments: dict[str, Any], project: Project
    ) -> Any:
        if method_name not in project_seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")

        method = project_seer_method_registry[method_name]

        arguments_without_org_and_project = {
            key: value
            for key, value in arguments.items()
            if key not in ["organization_id", "project_id"]
        }

        return method(
            **arguments_without_org_and_project,
            organization_id=project.organization.id,
            project_id=project.id,
        )

    @sentry_sdk.trace
    def post(self, request: Request, project: Project, method_name: str) -> Response:
        try:
            arguments: dict[str, Any] = request.data.get("args", {})
        except (KeyError, AttributeError) as e:
            raise ParseError from e

        try:
            result = self._dispatch_to_local_method(method_name, arguments, project)
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
