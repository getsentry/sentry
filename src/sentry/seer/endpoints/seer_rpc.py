import datetime
import hashlib
import hmac
import logging
import uuid
from collections.abc import Callable
from typing import Any, TypedDict

import sentry_sdk
from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import TraceItemDetailsRequest
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, internal_region_silo_endpoint
from sentry.api.endpoints.project_trace_item_details import convert_rpc_attribute_to_json
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.repository import Repository
from sentry.replays.usecases.summarize import rpc_get_replay_summary_logs
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events.types import SnubaParams
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
from sentry.seer.autofix.coding_agent import launch_coding_agents_for_run
from sentry.seer.autofix.utils import AutofixTriggerSource
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.entrypoints.operator import SeerOperator, process_autofix_updates
from sentry.seer.explorer.custom_tool_utils import call_custom_tool
from sentry.seer.explorer.index_data import (
    rpc_get_issues_for_transaction,
    rpc_get_profiles_for_trace,
    rpc_get_trace_for_transaction,
    rpc_get_transactions_for_project,
)
from sentry.seer.explorer.on_completion_hook import call_on_completion_hook
from sentry.seer.explorer.tools import (
    execute_table_query,
    execute_timeseries_query,
    execute_trace_table_query,
    get_baseline_tag_distribution,
    get_comparative_attribute_distributions,
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
from sentry.seer.issue_detection import create_issue_occurrence
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.silo.base import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc
from sentry.utils.env import in_test_environment
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded

logger = logging.getLogger(__name__)


class ColumnDict(TypedDict):
    name: str
    type: str


class SortDict(TypedDict):
    name: str
    type: str
    descending: bool


class SpansResponse(TypedDict):
    data: list[dict[str, Any]]
    meta: dict[str, Any]


def compare_signature(url: str, body: bytes, signature: str) -> bool:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.SEER_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without SEER_RPC_SHARED_SECRET"
        )

    if not signature.startswith("rpc0:"):
        logger.error("Seer RPC signature validation failed: invalid signature prefix")
        return False

    if not body:
        logger.error("Seer RPC signature validation failed: no body")
        return False

    try:
        # We aren't using the version bits currently.
        _, signature_data = signature.split(":", 2)

        signature_input = body

        for key in settings.SEER_RPC_SHARED_SECRET:
            computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
            is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
            if is_valid:
                return True
    except Exception:
        logger.exception("Seer RPC signature validation failed")
        return False

    logger.error("Seer RPC signature validation failed")

    return False


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class SeerRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for seer RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        if not compare_signature(request.path_info, request.body, token):
            raise AuthenticationFailed("Invalid signature")

        sentry_sdk.get_isolation_scope().set_tag("seer_rpc_auth", True)

        return (AnonymousUser(), token)


@internal_region_silo_endpoint
class SeerRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for seer microservice to call. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with seer.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    authentication_classes = (SeerRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    @sentry_sdk.trace
    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, SeerRpcSignatureAuthentication
        ):
            return True
        return False

    @sentry_sdk.trace
    def _dispatch_to_local_method(self, method_name: str, arguments: dict[str, Any]) -> Any:
        if method_name not in seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")
        # As seer is a single service, we just directly expose the methods instead of services.
        method = seer_method_registry[method_name]
        return method(**arguments)

    @sentry_sdk.trace
    def post(self, request: Request, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)

        if not self._is_authorized(request):
            raise PermissionDenied

        try:
            arguments: dict[str, Any] = request.data["args"]
        except KeyError as e:
            raise ParseError from e
        if not isinstance(arguments, dict):
            raise ParseError

        try:
            result = self._dispatch_to_local_method(method_name, arguments)
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
        except SnubaRPCRateLimitExceeded as e:
            sentry_sdk.capture_exception()
            raise Throttled(detail="Rate limit exceeded") from e
        except Exception as e:
            if in_test_environment():
                raise
            if settings.DEBUG:
                raise Exception(f"Problem processing seer rpc endpoint {method_name}") from e
            sentry_sdk.capture_exception()
            raise ValidationError from e
        return Response(data=result)


def get_organization_slug(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    return {"slug": org.slug}


def get_organization_project_ids(*, org_id: int) -> dict:
    """Get all active projects (IDs and slugs) for an organization"""
    from sentry.models.project import Project

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return {"projects": []}

    projects = list(
        Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).values(
            "id", "slug"
        )
    )

    return {"projects": projects}


class SentryOrganizaionIdsAndSlugs(TypedDict):
    org_ids: list[int]
    org_slugs: list[str]


def get_organization_autofix_consent(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    seer_org_acknowledgement = get_seer_org_acknowledgement(org)
    github_extension_enabled = org_id in options.get("github-extension.enabled-orgs")
    return {
        "consent": seer_org_acknowledgement or github_extension_enabled,
    }


def get_attributes_and_values(
    *,
    org_id: int,
    project_ids: list[int],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    max_values: int = 100,
    max_attributes: int = 1000,
    sampled: bool = True,
    attributes_ignored: list[str] | None = None,
) -> dict:
    """
    Fetches all string attributes and the corresponding values with counts for a given period.
    """
    start_dt, end_dt = get_date_range_from_params(
        {"start": start, "end": end, "statsPeriod": stats_period},
    )

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start_dt)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end_dt)

    sampling_mode = (
        DownsampledStorageConfig.MODE_NORMAL
        if sampled
        else DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
    )

    meta = RequestMeta(
        organization_id=org_id,
        cogs_category="events_analytics_platform",
        referrer=Referrer.SEER_RPC.value,
        project_ids=project_ids,
        start_timestamp=start_time_proto,
        end_timestamp=end_time_proto,
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
        downsampled_storage_config=DownsampledStorageConfig(mode=sampling_mode),
    )

    if attributes_ignored:
        filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="attr_key",
                    type=AttributeKey.TYPE_STRING,
                ),
                op=ComparisonFilter.OP_NOT_IN,
                value=AttributeValue(
                    val_str_array=StrArray(
                        values=attributes_ignored,
                    ),
                ),
            ),
        )
    else:
        filter = TraceItemFilter()

    stats_type = StatsType(
        attribute_distributions=AttributeDistributionsRequest(
            max_buckets=max_values,
            max_attributes=max_attributes,
        )
    )
    rpc_request = TraceItemStatsRequest(
        filter=filter,
        meta=meta,
        stats_types=[stats_type],
    )
    rpc_response = snuba_rpc.trace_item_stats_rpc(rpc_request)

    resolver = SearchResolver(
        params=SnubaParams(
            start=start_dt,
            end=end_dt,
        ),
        config=SearchResolverConfig(),
        definitions=SPAN_DEFINITIONS,
    )

    attributes_and_values: dict[str, list[dict[str, Any]]] = {}
    for result in rpc_response.results:
        for attribute in result.attribute_distributions.attributes:
            try:
                resolved_attribute, _ = resolver.resolve_attribute(attribute.attribute_name)
                attribute_name = resolved_attribute.public_alias
            except InvalidSearchQuery:
                attribute_name = attribute.attribute_name

            if attribute.buckets:
                if attribute_name not in attributes_and_values:
                    attributes_and_values[attribute_name] = []
                attributes_and_values[attribute_name].extend(
                    [
                        {
                            "value": value.label,
                            "count": value.value,
                        }
                        for value in attribute.buckets
                    ]
                )

    return {"attributes_and_values": attributes_and_values}


def get_attributes_for_span(
    *,
    org_id: int,
    project_id: int,
    trace_id: str,
    span_id: str,
) -> dict[str, Any]:
    """
    Fetch all attributes for a given span.
    """
    start_datetime = datetime.datetime.fromtimestamp(0, tz=datetime.UTC)
    end_datetime = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)

    start_timestamp_proto = ProtobufTimestamp()
    start_timestamp_proto.FromDatetime(start_datetime)

    end_timestamp_proto = ProtobufTimestamp()
    end_timestamp_proto.FromDatetime(end_datetime)

    trace_item_type = TraceItemType.TRACE_ITEM_TYPE_SPAN

    request_meta = RequestMeta(
        organization_id=org_id,
        cogs_category="events_analytics_platform",
        referrer=Referrer.SEER_RPC.value,
        project_ids=[project_id],
        start_timestamp=start_timestamp_proto,
        end_timestamp=end_timestamp_proto,
        trace_item_type=trace_item_type,
        request_id=str(uuid.uuid4()),
    )

    request = TraceItemDetailsRequest(
        item_id=span_id,
        trace_id=trace_id,
        meta=request_meta,
    )

    response = snuba_rpc.trace_item_details_rpc(request)
    response_dict = MessageToDict(response)

    attributes = convert_rpc_attribute_to_json(
        response_dict.get("attributes", []),
        SupportedTraceItemType.SPANS,
        use_sentry_conventions=False,
        include_internal=False,
    )

    return {
        "attributes": attributes,
    }


def get_github_enterprise_integration_config(
    *, organization_id: int, integration_id: int
) -> dict[str, Any]:
    if not settings.SEER_GHE_ENCRYPT_KEY:
        logger.error("Cannot encrypt access token without SEER_GHE_ENCRYPT_KEY")
        return {"success": False}

    integration = integration_service.get_integration(
        integration_id=integration_id,
        provider=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        logger.error("Integration %s does not exist", integration_id)
        return {"success": False}

    installation = integration.get_installation(organization_id=organization_id)
    assert isinstance(installation, GitHubEnterpriseIntegration)

    integration = integration_service.refresh_github_access_token(
        integration_id=integration.id,
        organization_id=organization_id,
    )

    assert integration is not None, "Integration should have existed given previous checks"

    access_token = integration.metadata["access_token"]
    permissions = integration.metadata["permissions"]

    if not access_token:
        logger.error("No access token found for integration %s", integration.id)
        return {"success": False}

    try:
        fernet = Fernet(settings.SEER_GHE_ENCRYPT_KEY.encode("utf-8"))
        encrypted_access_token = fernet.encrypt(access_token.encode("utf-8")).decode("utf-8")
    except Exception:
        logger.exception("Failed to encrypt access token")
        return {"success": False}

    return {
        "success": True,
        "base_url": f"https://{installation.model.metadata['domain_name'].split('/')[0]}/api/v3",
        "verify_ssl": installation.model.metadata["installation"]["verify_ssl"],
        "encrypted_access_token": encrypted_access_token,
        "permissions": permissions,
    }


def send_seer_webhook(*, event_name: str, organization_id: int, payload: dict) -> dict:
    """
    Handles receipt (in Sentry, from Seer) of a seer webhook event for an organization.

    Previously, this just broadcast webhooks to the relevant Sentry Apps.
    Now, it allows other Sentry features to leverage this signal.

    Args:
        event_name: The sub-name of seer event (e.g., "root_cause_started")
        organization_id: The ID of the organization to send the webhook for
        payload: The webhook payload data

    Returns:
        dict: Status of the webhook sending operation
    """
    # Validate event_name by constructing the full event type and checking if it's valid
    from sentry.sentry_apps.metrics import SentryAppEventType

    event_type = f"seer.{event_name}"
    try:
        sentry_app_event_type = SentryAppEventType(event_type)
    except ValueError:
        logger.exception(
            "seer.webhook_invalid_event_type",
            extra={"event_type": event_type},
        )
        return {"success": False, "error": f"Invalid event type: {event_type}"}

    # Handle organization lookup safely
    try:
        organization = Organization.objects.get(
            id=organization_id, status=OrganizationStatus.ACTIVE
        )
    except Organization.DoesNotExist:
        logger.exception(
            "seer.webhook_organization_not_found_or_not_active",
            extra={"organization_id": organization_id},
        )
        return {"success": False, "error": "Organization not found or not active"}

    if SeerOperator.has_access(organization=organization):
        process_autofix_updates.apply_async(
            kwargs={
                "event_type": sentry_app_event_type,
                "event_payload": payload,
                "organization_id": organization_id,
            }
        )

    if not features.has("organizations:seer-webhooks", organization):
        return {"success": False, "error": "Seer webhooks are not enabled for this organization"}

    broadcast_webhooks_for_organization.delay(
        resource_name="seer",
        event_name=event_name,
        organization_id=organization_id,
        payload=payload,
    )

    return {"success": True}


def trigger_coding_agent_launch(
    *,
    organization_id: int,
    integration_id: int,
    run_id: int,
    trigger_source: str = "solution",
) -> dict:
    """
    Trigger a coding agent launch for an autofix run.

    Args:
        organization_id: The organization ID
        integration_id: The coding agent integration ID
        run_id: The autofix run ID
        trigger_source: Either "root_cause" or "solution" (default: "solution")

    Returns:
        dict: {"success": bool}
    """
    try:
        launch_coding_agents_for_run(
            organization_id=organization_id,
            integration_id=integration_id,
            run_id=run_id,
            trigger_source=AutofixTriggerSource(trigger_source),
        )
        return {"success": True}
    except (NotFound, PermissionDenied, ValidationError, APIException):
        logger.exception(
            "coding_agent.rpc_launch_error",
            extra={
                "organization_id": organization_id,
                "integration_id": integration_id,
                "run_id": run_id,
            },
        )
        return {"success": False}


def validate_repo(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    owner: str,
    name: str,
) -> dict[str, Any]:
    """
    Validate that a repository exists and belongs to the given organization.

    Args:
        organization_id: The Sentry organization ID
        provider: The SCM provider (e.g., "github", "github_enterprise")
        external_id: The repository's external ID in the provider's system
        owner: The repository owner (e.g., "getsentry")
        name: The repository name (e.g., "sentry")

    Returns:
        {"valid": True, "integration_id": <int|None>} if valid
        {"valid": False, "reason": <str>} if invalid
    """
    expected_name = f"{owner}/{name}"

    repo = Repository.objects.filter(
        Q(provider=provider) | Q(provider=f"integrations:{provider}"),
        organization_id=organization_id,
        external_id=external_id,
        name=expected_name,
        status=ObjectStatus.ACTIVE,
    ).first()

    if not repo:
        return {"valid": False, "reason": "repository_not_found"}

    if repo.provider not in SEER_SUPPORTED_SCM_PROVIDERS:
        return {"valid": False, "reason": "unsupported_provider"}

    return {"valid": True, "integration_id": repo.integration_id}


def check_repository_integrations_status(*, repository_integrations: list[dict[str, Any]]) -> dict:
    """
    Check whether repository integrations exist and are active.

    Args:
        repository_integrations: List of dicts, each containing:
            - organization_id: Organization ID (required)
            - external_id: External repository ID (required)
            - provider: Provider identifier (required, e.g., "github", "github_enterprise")
                       Supports both with and without "integrations:" prefix

    Returns:
        dict: {
            "integration_ids": list of integration IDs (as integers) from the database,
                              or None if repository doesn't exist/isn't active/doesn't have an integration id
        }
        e.g., {"integration_ids": [123, None, 456]}
        None indicates repository not found, inactive, or has unsupported SCM provider.
        The integration_ids are returned so Seer can store them for future reference.

    Note:
        - Repositories are matched by (organization_id, provider, external_id) which has a unique constraint
        - integration_id is NOT required in the request and NOT used in matching
        - integration_id from the database is returned as an integer so Seer can store it for future reference
    """

    if not repository_integrations:
        return {"integration_ids": []}

    logger.info(
        "seer_rpc.check_repository_integrations_status.called",
        extra={
            "repository_integrations_count": len(repository_integrations),
            "repository_integrations_sample": repository_integrations[:10],
        },
    )

    q_objects = Q()

    for item in repository_integrations:
        # Match only by organization_id, provider, and external_id
        q_objects |= Q(
            organization_id=item["organization_id"],
            provider=f"integrations:{item['provider']}",
            external_id=item["external_id"],
        ) | Q(
            organization_id=item["organization_id"],
            provider=item["provider"],
            external_id=item["external_id"],
        )

    existing_repos = Repository.objects.filter(
        q_objects, status=ObjectStatus.ACTIVE, provider__in=SEER_SUPPORTED_SCM_PROVIDERS
    ).values_list("organization_id", "provider", "integration_id", "external_id")

    existing_map: dict[tuple, int | None] = {}

    for org_id, provider, integration_id, external_id in existing_repos:
        key = (org_id, provider, external_id)
        # If multiple repos match (shouldn't happen), keep the first one
        if key not in existing_map:
            existing_map[key] = integration_id

    integration_ids = []

    for item in repository_integrations:
        repo_tuple_with_prefix = (
            item["organization_id"],
            f"integrations:{item['provider']}",
            item["external_id"],
        )
        repo_tuple_without_prefix = (
            item["organization_id"],
            item["provider"],
            item["external_id"],
        )

        found_integration_id = existing_map.get(repo_tuple_with_prefix) or existing_map.get(
            repo_tuple_without_prefix
        )

        integration_ids.append(found_integration_id)

    logger.info(
        "seer_rpc.check_repository_integrations_status.completed",
        extra={"integration_ids": integration_ids},
    )

    return {"integration_ids": integration_ids}


seer_method_registry: dict[str, Callable] = {  # return type must be serialized
    # Common to Seer features
    "get_github_enterprise_integration_config": get_github_enterprise_integration_config,
    "get_organization_project_ids": get_organization_project_ids,
    "check_repository_integrations_status": check_repository_integrations_status,
    "validate_repo": validate_repo,
    #
    # Autofix
    "get_organization_slug": get_organization_slug,
    "get_organization_autofix_consent": get_organization_autofix_consent,
    "get_error_event_details": get_error_event_details,
    "get_profile_details": get_profile_details,
    "send_seer_webhook": send_seer_webhook,
    "get_attributes_for_span": get_attributes_for_span,
    "trigger_coding_agent_launch": trigger_coding_agent_launch,
    #
    # Bug prediction
    "get_issues_by_function_name": by_function_name.fetch_issues,
    "get_issues_related_to_exception_type": by_error_type.fetch_issues,
    "get_issues_by_raw_query": by_text_query.fetch_issues,
    "get_latest_issue_event": utils.get_latest_issue_event,
    #
    # Assisted query
    "get_attribute_names": get_attribute_names,
    "get_attribute_values_with_substring": get_attribute_values_with_substring,
    "get_attributes_and_values": get_attributes_and_values,
    "get_issue_filter_keys": get_issue_filter_keys,
    "get_filter_key_values": get_filter_key_values,
    "get_issues_stats": get_issues_stats,
    "get_event_filter_keys": get_event_filter_keys,
    "get_event_filter_key_values": get_event_filter_key_values,
    #
    # Explorer
    "get_transactions_for_project": rpc_get_transactions_for_project,
    "get_trace_for_transaction": rpc_get_trace_for_transaction,
    "get_profiles_for_trace": rpc_get_profiles_for_trace,
    "get_issues_for_transaction": rpc_get_issues_for_transaction,
    "get_trace_waterfall": rpc_get_trace_waterfall,
    "get_issue_and_event_details_v2": get_issue_and_event_details_v2,
    "get_profile_flamegraph": rpc_get_profile_flamegraph,
    "execute_table_query": execute_table_query,
    "execute_timeseries_query": execute_timeseries_query,
    "execute_trace_table_query": execute_trace_table_query,
    "execute_issues_query": execute_issues_query,
    "get_trace_item_attributes": get_trace_item_attributes,
    "get_repository_definition": get_repository_definition,
    "call_custom_tool": call_custom_tool,
    "call_on_completion_hook": call_on_completion_hook,
    "get_log_attributes_for_trace": get_log_attributes_for_trace,
    "get_metric_attributes_for_trace": get_metric_attributes_for_trace,
    "get_baseline_tag_distribution": get_baseline_tag_distribution,
    "get_comparative_attribute_distributions": get_comparative_attribute_distributions,
    #
    # Replays
    "get_replay_summary_logs": rpc_get_replay_summary_logs,
    "get_replay_metadata": get_replay_metadata,
    #
    # Issue Detection
    "create_issue_occurrence": create_issue_occurrence,
}


def generate_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verfication during key rotation.
    """
    if not settings.SEER_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException("Cannot sign RPC requests without RPC_SHARED_SECRET")

    signature_input = body
    secret = settings.SEER_RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"
