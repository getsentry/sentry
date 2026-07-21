import datetime
import hashlib
import hmac
import logging
import uuid
from typing import Any, TypedDict

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from pydantic import BaseModel
from requests.exceptions import RequestException
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    Throttled,
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

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, internal_cell_silo_endpoint
from sentry.api.endpoints.project_trace_item_details import convert_rpc_attribute_to_json
from sentry.api.utils import get_date_range_from_params
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidSearchQuery
from sentry.features.base import OrganizationFeature
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.identity import default_manager as identity_manager
from sentry.identity.oauth2 import OAuth2Provider
from sentry.identity.services.identity import identity_service
from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import MONITORING_PROVIDERS, IntegrationProviderSlug
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.pr_metrics.attribution import (
    DELEGATED_SIGNAL_TYPES,
    DelegatedAgentSignalDetails,
    record_attribution_signal,
)
from sentry.pr_metrics.judge import update_pr_metrics
from sentry.replays.usecases.summarize import rpc_get_replay_summary_logs
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events.types import SnubaParams
from sentry.seer.agent.context_engine_utils import get_instrumentation_types
from sentry.seer.agent.custom_tool_utils import call_custom_tool
from sentry.seer.agent.feature_delivery import DELIVERY_HANDLERS, FeatureRunStatus
from sentry.seer.agent.index_data import (
    rpc_get_issues_for_transaction,
    rpc_get_profiles_for_trace,
    rpc_get_trace_for_transaction,
    rpc_get_transactions_for_project,
)
from sentry.seer.agent.monitoring_providers import (
    get_monitoring_provider_connections as fetch_monitoring_provider_connections,
)
from sentry.seer.agent.on_completion_hook import call_on_completion_hook
from sentry.seer.agent.tools import (
    execute_replays_query,
    execute_table_query,
    execute_timeseries_query,
    execute_trace_table_query,
    get_baseline_tag_distribution,
    get_dsn,
    get_event_details,
    get_issue_and_event_details_v2,
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
from sentry.seer.auth import SeerRpcViewerContextAuthentication
from sentry.seer.autofix.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.autofix.utils import read_preference_from_sentry_db
from sentry.seer.constants import SeerSCMProvider
from sentry.seer.endpoints.registry import SeerRpcMethod, seer_rpc
from sentry.seer.entrypoints.operator import SeerAutofixOperator, process_autofix_updates
from sentry.seer.fetch_issues import by_error_type, by_function_name, by_text_query, utils
from sentry.seer.fetch_issues.utils import NoProjectsForRepoError, get_repo_and_projects
from sentry.seer.issue_detection import create_issue_occurrence
from sentry.seer.models.seer_api_models import SeerProjectPreference
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.seer.sentry_data_models import (
    AttributeBucket,
    AttributesAndValuesResponse,
    GetRepoInstallationIdErrorResponse,
    GetRepoInstallationIdSuccessResponse,
    GitHubEnterpriseConfigErrorResponse,
    GitHubEnterpriseConfigSuccessResponse,
    HasRepoCodeMappingsResponse,
    MonitoringProviderConnectionsResponse,
    OrganizationAutofixConsentResponse,
    OrganizationFeaturesResponse,
    OrganizationProjectDetail,
    OrganizationProjectsResponse,
    OrganizationSlugResponse,
    PrAttributionResponse,
    RefreshMonitoringProviderTokenErrorResponse,
    RefreshMonitoringProviderTokenSuccessResponse,
    SendSeerWebhookErrorResponse,
    SendSeerWebhookSuccessResponse,
    SpanAttribute,
    SpanAttributesResponse,
)
from sentry.seer.utils import encrypt_access_token_for_seer, filter_repo_by_provider
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.users.services.user.service import user_service
from sentry.utils import metrics, snuba_rpc
from sentry.utils.env import in_test_environment
from sentry.utils.snuba_rpc import SnubaRPCRateLimitExceeded
from sentry.utils.tracing import start_span, trace
from sentry.viewer_context import (
    get_viewer_context,
    observe_viewer_context_propagation,
)

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

    DEPRECATED: part of the HMAC RPC auth mechanism being retired in favor of
    signed ``X-Viewer-Context`` (see ``SeerRpcSignatureAuthentication``).
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


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.CELL)
class SeerRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for seer RPC requests.
    Requests are sent with an HMAC signed by a shared private key.

    DEPRECATED: this HMAC mechanism (backed by ``SEER_RPC_SHARED_SECRET``) is
    slated for removal. Seer<->Sentry auth is consolidating onto the signed
    ``X-Viewer-Context`` header (see ``SeerRpcViewerContextAuthentication``).
    Removal order: (1) this endpoint accepts viewer context [done],
    (2) Seer stops sending ``Rpcsignature``, (3) delete this class +
    ``compare_signature``, (4) retire ``SEER_RPC_SHARED_SECRET`` (only after
    step 2 --- an inbound signature with the secret unset raises).
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
        sentry_sdk.get_isolation_scope().set_attribute("seer_rpc_auth", True)

        return (AnonymousUser(), token)


@internal_cell_silo_endpoint
class SeerRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for seer microservice to call. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with seer.
    """

    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    # HMAC is listed first so it wins when a caller sends both credentials
    # (Seer sends both today), keeping this a no-op at rollout. The viewer
    # context authenticator only engages when there is no valid Rpcsignature.
    authentication_classes = (
        SeerRpcSignatureAuthentication,
        SeerRpcViewerContextAuthentication,
    )
    permission_classes = ()
    enforce_rate_limit = False

    @trace
    def _is_authorized(self, request: Request) -> bool:
        return bool(request.auth) and isinstance(
            request.successful_authenticator,
            (SeerRpcSignatureAuthentication, SeerRpcViewerContextAuthentication),
        )

    def _enforce_viewer_context_org_binding(
        self, request: Request, arguments: dict[str, Any]
    ) -> None:
        """Bind a viewer-context-authenticated call to the signed context's org.

        This endpoint has no per-org access control — ``org_id`` is a trusted
        argument. That is safe for HMAC callers (only Seer holds the secret), but
        as viewer-context auth generalizes to any caller, an unforgeable VC for
        org A must not be usable to read org B. HMAC calls keep god-mode.
        """
        if not isinstance(request.successful_authenticator, SeerRpcViewerContextAuthentication):
            return

        arg_org_id = arguments.get("org_id", arguments.get("organization_id"))
        if arg_org_id is None:
            return

        # ``arg_org_id`` is caller-supplied and only validated to live under a
        # dict; coerce defensively so malformed input is a 400, not a 500.
        try:
            arg_org_id = int(arg_org_id)
        except (TypeError, ValueError):
            raise ParseError("Invalid organization id")

        vc = getattr(request, "_seer_rpc_viewer_context", None)
        vc_org_id = vc.organization_id if vc is not None else None
        if vc_org_id is None or arg_org_id != int(vc_org_id):
            metrics.incr(
                "seer.rpc.viewer_context_org_binding",
                tags={"outcome": "mismatch"},
            )
            raise PermissionDenied("Viewer context organization does not match request")

    @trace
    def _dispatch_to_local_method(self, method_name: str, arguments: dict[str, Any]) -> Any:
        if method_name not in seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")
        # As seer is a single service, we just directly expose the methods instead of services.
        method = seer_method_registry[method_name]
        result = method(**arguments)
        # Convert Pydantic returns to dict so DRF's JSONRenderer can serialize.
        if isinstance(result, BaseModel):
            return result.dict()
        return result

    @trace
    def post(self, request: Request, method_name: str) -> Response:
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
            "seer_rpc_in",
            ctx=get_viewer_context() if has_vc_header else None,
            extra_attributes={"method": method_name},
        )

        if not self._is_authorized(request):
            raise PermissionDenied

        try:
            arguments: dict[str, Any] = request.data["args"]
        except KeyError as e:
            raise ParseError from e
        if not isinstance(arguments, dict):
            raise ParseError

        self._enforce_viewer_context_org_binding(request, arguments)

        try:
            result = self._dispatch_to_local_method(method_name, arguments)
        except RpcResolutionException as e:
            sentry_sdk.capture_exception()
            raise NotFound from e
        except SerializableFunctionValueException as e:
            sentry_sdk.capture_exception()
            raise ParseError from e
        except ObjectDoesNotExist as e:
            raise NotFound from e
        except SnubaRPCRateLimitExceeded as e:
            sentry_sdk.capture_exception()
            raise Throttled(detail="Rate limit exceeded") from e
        except APIException:
            raise
        except Exception as e:
            if in_test_environment():
                raise
            if settings.DEBUG:
                raise Exception(f"Problem processing seer rpc endpoint {method_name}") from e
            sentry_sdk.capture_exception()
            raise APIException from e
        return Response(data=result)


def get_organization_slug(*, org_id: int) -> OrganizationSlugResponse:
    org: Organization = Organization.objects.get(id=org_id)
    return OrganizationSlugResponse(slug=org.slug)


def get_organization_projects(*, org_id: int) -> OrganizationProjectsResponse:
    """Get all active projects with instrumentation types for an organization"""
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return OrganizationProjectsResponse(projects=[])

    projects = [
        OrganizationProjectDetail(
            id=project.id,
            slug=project.slug,
            instrumentation=get_instrumentation_types(project),
        )
        for project in Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
    ]

    return OrganizationProjectsResponse(projects=projects)


_ORGANIZATION_SCOPE_PREFIX = "organizations:"


def get_organization_features(
    *, org_id: int, user_id: int | None = None
) -> OrganizationFeaturesResponse:
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        return OrganizationFeaturesResponse(features=[])

    actor = user_service.get_user(user_id=user_id) if user_id is not None else None

    features_to_check = {
        feature
        for feature in features.all(feature_type=OrganizationFeature, api_expose_only=True).keys()
        if feature.startswith(_ORGANIZATION_SCOPE_PREFIX)
    }

    feature_set: set[str] = set()

    with start_span(op="features.check", name="check batch features"):
        batch = features.batch_has(
            list(features_to_check),
            actor=actor,
            organization=organization,
            skip_experiment_exposure=True,
        )

        if batch:
            for name, active in batch.get(f"organization:{organization.id}", {}).items():
                if active:
                    feature_set.add(name[len(_ORGANIZATION_SCOPE_PREFIX) :])
                features_to_check.discard(name)

    with start_span(op="features.check", name="check individual features"):
        for name in features_to_check:
            if features.has(name, organization, actor=actor, skip_entity=True):
                feature_set.add(name[len(_ORGANIZATION_SCOPE_PREFIX) :])

    return OrganizationFeaturesResponse(features=sorted(feature_set))


class SentryOrganizaionIdsAndSlugs(TypedDict):
    org_ids: list[int]
    org_slugs: list[str]


def get_organization_autofix_consent(*, org_id: int) -> OrganizationAutofixConsentResponse:
    return OrganizationAutofixConsentResponse(consent=True)


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
) -> AttributesAndValuesResponse:
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

    attributes_and_values: dict[str, list[AttributeBucket]] = {}
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
                    AttributeBucket(value=value.label, count=value.value)
                    for value in attribute.buckets
                )

    return AttributesAndValuesResponse(attributes_and_values=attributes_and_values)


def get_attributes_for_span(
    *,
    org_id: int,
    project_id: int,
    trace_id: str,
    span_id: str,
) -> SpanAttributesResponse:
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
        include_internal=False,
    )

    return SpanAttributesResponse(attributes=[SpanAttribute(**a) for a in attributes])


def get_github_enterprise_integration_config(
    *, organization_id: int, integration_id: int
) -> GitHubEnterpriseConfigSuccessResponse | GitHubEnterpriseConfigErrorResponse:
    if not settings.SEER_GHE_ENCRYPT_KEY:
        logger.error("Cannot encrypt access token without SEER_GHE_ENCRYPT_KEY")
        return GitHubEnterpriseConfigErrorResponse()

    integration = integration_service.get_integration(
        integration_id=integration_id,
        provider=IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        logger.error("Integration %s does not exist", integration_id)
        return GitHubEnterpriseConfigErrorResponse()

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
        return GitHubEnterpriseConfigErrorResponse()

    encrypted_access_token = encrypt_access_token_for_seer(access_token)
    if not encrypted_access_token:
        return GitHubEnterpriseConfigErrorResponse()

    return GitHubEnterpriseConfigSuccessResponse(
        base_url=f"https://{installation.model.metadata['domain_name'].split('/')[0]}/api/v3",
        verify_ssl=installation.model.metadata["installation"]["verify_ssl"],
        encrypted_access_token=encrypted_access_token,
        permissions=permissions,
    )


def send_seer_webhook(
    *, event_name: str, organization_id: int, payload: dict
) -> SendSeerWebhookSuccessResponse | SendSeerWebhookErrorResponse:
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
    event_type = f"seer.{event_name}"
    try:
        sentry_app_event_type = SentryAppEventType(event_type)
    except ValueError:
        logger.exception(
            "seer.webhook_invalid_event_type",
            extra={"event_type": event_type},
        )
        return SendSeerWebhookErrorResponse(error=f"Invalid event type: {event_type}")

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
        return SendSeerWebhookErrorResponse(error="Organization not found or not active")

    if SeerAutofixOperator.has_access(organization=organization):
        process_autofix_updates.apply_async(
            kwargs={
                "event_type": sentry_app_event_type,
                "event_payload": payload,
                "organization_id": organization_id,
            }
        )

    broadcast_webhooks_for_organization.delay(
        resource_name="seer",
        event_name=event_name,
        organization_id=organization_id,
        payload=payload,
    )

    return SendSeerWebhookSuccessResponse()


def has_repo_code_mappings(
    *, organization_id: int, provider: SeerSCMProvider, external_id: str, owner: str, name: str
) -> HasRepoCodeMappingsResponse:
    """
    Validate that a repository exists and belongs to the given organization.

    Args:
        organization_id: The Sentry organization ID
        provider: The SCM provider (e.g., "github", "github_enterprise", w/ or w/o "integrations:" prefix)
        external_id: The repository's external ID in the provider's system
        owner: The repository owner (e.g., "getsentry")
        name: The repository name (e.g., "sentry")
    """
    try:
        repo_projects = get_repo_and_projects(organization_id, provider, external_id, owner, name)
    except (Repository.DoesNotExist, NoProjectsForRepoError):
        return HasRepoCodeMappingsResponse(has_code_mappings=False, project_slug_to_id={})

    project_slug_to_id = dict(
        sorted((project.slug, project.id) for project in repo_projects.projects)
    )
    return HasRepoCodeMappingsResponse(
        has_code_mappings=True, project_slug_to_id=project_slug_to_id
    )


def get_repo_installation_id(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    owner: str,
    name: str,
) -> GetRepoInstallationIdSuccessResponse | GetRepoInstallationIdErrorResponse:
    """
    Look up a repository and return the external_id of its associated integration (the installation ID).

    Args:
        organization_id: The Sentry organization ID
        provider: The SCM provider (e.g., "github", "github_enterprise")
        external_id: The repository's external ID in the provider's system
        owner: The repository owner (e.g., "getsentry")
        name: The repository name (e.g., "sentry")
    """
    repo = filter_repo_by_provider(organization_id, provider, external_id, owner, name).first()

    if not repo:
        return GetRepoInstallationIdErrorResponse(error="repository_not_found")

    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return GetRepoInstallationIdErrorResponse(error="organization_not_found")
    if repo.provider not in get_supported_scm_providers(organization):
        logger.warning("seer.scm.unsupported_provider", extra={"provider": repo.provider})
        return GetRepoInstallationIdErrorResponse(error="unsupported_provider")

    if repo.integration_id is None:
        return GetRepoInstallationIdErrorResponse(error="no_integration")

    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if integration is None:
        return GetRepoInstallationIdErrorResponse(error="integration_not_found")

    # GitHub stores the installation ID as the integration's external_id,
    # while GitHub Enterprise stores it in metadata["installation_id"].
    if integration.provider == IntegrationProviderSlug.GITHUB_ENTERPRISE.value:
        installation_id = integration.metadata.get("installation_id")
    elif integration.provider == IntegrationProviderSlug.GITHUB.value:
        installation_id = integration.external_id
    else:
        logger.warning("seer.scm.unsupported_provider", extra={"provider": integration.provider})
        return GetRepoInstallationIdErrorResponse(error="unsupported_provider")

    if not installation_id:
        return GetRepoInstallationIdErrorResponse(error="installation_id_not_found")

    return GetRepoInstallationIdSuccessResponse(
        installation_id=installation_id,
        permissions=integration.metadata.get("permissions"),
    )


def get_project_preferences(*, organization_id: int, project_id: int) -> SeerProjectPreference:
    """Get Seer project preferences for a single project.

    Raises Project.DoesNotExist if the project is not found or doesn't belong to the org.
    """
    project = Project.objects.get_from_cache(id=project_id)
    if project.organization_id != organization_id:
        raise Project.DoesNotExist

    return read_preference_from_sentry_db(project)


def deliver_feature_result(
    *,
    organization_id: int,
    feature_id: str,
    run_uuid: str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    """Dispatch a feature result from Seer to the registered handler."""
    handler = DELIVERY_HANDLERS.get(feature_id)
    if handler is None:
        logger.warning(
            "seer.feature_delivery.unknown_feature_id",
            extra={"feature_id": feature_id, "run_uuid": run_uuid},
        )
        return

    handler(organization_id, run_uuid, status, result, error)


def get_monitoring_provider_connections(
    *, organization_id: int, user_id: int
) -> MonitoringProviderConnectionsResponse:
    """Fetch the user's connected monitoring provider identities."""
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return MonitoringProviderConnectionsResponse(connections=[])

    if (
        organization_service.check_membership_by_id(
            organization_id=organization_id, user_id=user_id
        )
        is None
    ):
        return MonitoringProviderConnectionsResponse(connections=[])

    return MonitoringProviderConnectionsResponse(
        connections=fetch_monitoring_provider_connections(organization, user_id)
    )


def refresh_monitoring_provider_token(
    *, identity_id: int
) -> RefreshMonitoringProviderTokenSuccessResponse | RefreshMonitoringProviderTokenErrorResponse:
    """Refresh the access token for a monitoring provider identity."""
    if not settings.SEER_GHE_ENCRYPT_KEY:
        logger.error("Cannot encrypt monitoring provider access token without SEER_GHE_ENCRYPT_KEY")
        return RefreshMonitoringProviderTokenErrorResponse(error="encryption_failed")

    identity = identity_service.get_identity(filter={"id": identity_id})
    if identity is None:
        logger.error(
            "monitoring_provider.refresh.identity_not_found", extra={"identity_id": identity_id}
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="identity_not_found")

    idp = identity_service.get_provider(provider_id=identity.idp_id)
    if idp is None or idp.type not in MONITORING_PROVIDERS:
        logger.error(
            "monitoring_provider.refresh.identity_provider_not_found",
            extra={
                "identity_id": identity.id,
                "idp_id": identity.idp_id,
                "idp_type": idp.type if idp is not None else None,
            },
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="identity_not_found")

    provider = identity_manager.get(idp.type)
    if not isinstance(provider, OAuth2Provider):
        # Static-token providers (e.g. Datadog PAT) have no refresh flow.
        return RefreshMonitoringProviderTokenErrorResponse(error="refresh_not_supported")

    try:
        provider.refresh_identity(identity)
    except IdentityNotValid as exc:
        upstream_error = ""
        cause = exc.__cause__
        if cause is not None and hasattr(cause, "response") and cause.response is not None:
            upstream_error = cause.response.text[:512]
        logger.exception(
            "monitoring_provider.refresh.identity_not_valid",
            extra={
                "identity_id": identity_id,
                "provider": idp.type,
                "has_refresh_token": "refresh_token" in identity.data,
                "upstream_error": upstream_error,
            },
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="identity_not_valid")
    except (ApiError, KeyError, RequestException):
        logger.exception(
            "monitoring_provider.refresh.failed",
            extra={"identity_id": identity_id, "provider": idp.type},
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="refresh_failed")

    access_token = identity.data.get("access_token")
    if not access_token:
        logger.error(
            "monitoring_provider.refresh.access_token_not_found", extra={"identity_id": identity.id}
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="identity_not_valid")

    encrypted_auth_header = encrypt_access_token_for_seer(f"Bearer {access_token}")
    if not encrypted_auth_header:
        logger.error(
            "monitoring_provider.refresh.access_token_encryption_failed",
            extra={"identity_id": identity.id},
        )
        return RefreshMonitoringProviderTokenErrorResponse(error="encryption_failed")

    return RefreshMonitoringProviderTokenSuccessResponse(
        encrypted_auth_headers={"Authorization": encrypted_auth_header},
        expires=identity.data.get("expires"),
    )


def record_pr_attribution(
    *,
    organization_id: int,
    pull_request_id: int,
    signal_type: str,
    signal_details: dict[str, Any] | None = None,
) -> PrAttributionResponse:
    """Record a PR attribution signal on behalf of Seer.

    Idempotent via the unique constraint on
    PullRequestAttribution(pull_request, signal_type, source).

    Args:
        organization_id: Sentry organization that owns the PR.
        pull_request_id: Sentry-internal PullRequest.id.
        signal_type: A PullRequestAttributionSignalType value.
        signal_details: Arbitrary provider-specific metadata to store on the row.

    Returns:
        {"attribution_id": int} on success, or {"attribution_id": None} when the
        pr-metrics-attribution feature is disabled for the org.
    """
    try:
        signal = PullRequestAttributionSignalType(signal_type)
    except ValueError:
        raise ParseError(detail=f"Unknown signal_type: {signal_type!r}")

    try:
        organization = Organization.objects.get(
            id=organization_id, status=OrganizationStatus.ACTIVE
        )
    except Organization.DoesNotExist:
        raise ObjectDoesNotExist(f"Organization {organization_id} not found or inactive")

    if not features.has("organizations:pr-metrics-attribution", organization):
        logger.info(
            "seer.record_pr_attribution.feature_disabled",
            extra={"organization_id": organization_id, "pull_request_id": pull_request_id},
        )
        return PrAttributionResponse(attribution_id=None)

    try:
        pull_request = PullRequest.objects.get(
            id=pull_request_id,
            organization_id=organization_id,
        )
    except PullRequest.DoesNotExist:
        raise ObjectDoesNotExist(
            f"PullRequest {pull_request_id} not found in org {organization_id}"
        )

    if signal in DELEGATED_SIGNAL_TYPES:
        try:
            signal_details = DelegatedAgentSignalDetails.parse_obj(signal_details or {}).dict()
        except Exception:
            raise ParseError(
                detail="signal_details does not match DelegatedAgentSignalDetails schema"
            )

    attribution = record_attribution_signal(
        pull_request=pull_request,
        signal_type=signal,
        source=PullRequestAttributionSource.SEER_DATA,
        signal_details=signal_details,
    )
    logger.info(
        "seer.record_pr_attribution.recorded",
        extra={
            "organization_id": organization_id,
            "pull_request_id": pull_request_id,
            "signal_type": signal_type,
            "attribution_id": attribution.id,
        },
    )
    return PrAttributionResponse(attribution_id=attribution.id)


# Every value below MUST be a function returning a `pydantic.BaseModel` (or
# a union of `BaseModel` subclasses, optionally with `None`). Two complementary
# guards enforce this:
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
seer_method_registry: dict[str, SeerRpcMethod] = {  # return type must be serialized
    # Common to Seer features
    "get_github_enterprise_integration_config": seer_rpc(get_github_enterprise_integration_config),
    "get_organization_projects": seer_rpc(get_organization_projects),
    "get_organization_features": seer_rpc(get_organization_features),
    "get_repo_installation_id": seer_rpc(get_repo_installation_id),
    #
    # Autofix
    "get_organization_slug": seer_rpc(get_organization_slug),
    "get_organization_autofix_consent": seer_rpc(get_organization_autofix_consent),
    "get_error_event_details": seer_rpc(get_error_event_details),
    "get_profile_details": seer_rpc(get_profile_details),
    "send_seer_webhook": seer_rpc(send_seer_webhook),
    "get_attributes_for_span": seer_rpc(get_attributes_for_span),
    "get_project_preferences": seer_rpc(get_project_preferences),
    #
    # Bug prediction
    "has_repo_code_mappings": seer_rpc(has_repo_code_mappings),
    "get_issues_by_function_name": seer_rpc(by_function_name.fetch_issues),
    "get_issues_related_to_exception_type": seer_rpc(by_error_type.fetch_issues),
    "get_issues_by_raw_query": seer_rpc(by_text_query.fetch_issues),
    "get_latest_issue_event": seer_rpc(utils.get_latest_issue_event),
    #
    # Assisted query
    "get_attribute_names": seer_rpc(get_attribute_names),
    "get_attribute_values_with_substring": seer_rpc(get_attribute_values_with_substring),
    "get_attributes_and_values": seer_rpc(get_attributes_and_values),
    "get_metric_metadata": seer_rpc(get_metric_metadata),
    "get_issue_filter_keys": seer_rpc(get_issue_filter_keys),
    "get_filter_key_values": seer_rpc(get_filter_key_values),
    "get_issues_stats": seer_rpc(get_issues_stats),
    "get_event_filter_keys": seer_rpc(get_event_filter_keys),
    "get_event_filter_key_values": seer_rpc(get_event_filter_key_values),
    #
    # Agent
    "get_transactions_for_project": seer_rpc(rpc_get_transactions_for_project),
    "get_trace_for_transaction": seer_rpc(rpc_get_trace_for_transaction),
    "get_profiles_for_trace": seer_rpc(rpc_get_profiles_for_trace),
    "get_issues_for_transaction": seer_rpc(rpc_get_issues_for_transaction),
    "get_trace_waterfall": seer_rpc(rpc_get_trace_waterfall),
    "get_issue_and_event_details_v2": seer_rpc(get_issue_and_event_details_v2),
    "get_issue_details": seer_rpc(get_issue_details),
    "get_issue_committers": seer_rpc(get_issue_committers),
    "get_issue_ownership": seer_rpc(get_issue_ownership),
    "get_team_members": seer_rpc(get_team_members),
    "get_event_details": seer_rpc(get_event_details),
    "get_profile_flamegraph": seer_rpc(rpc_get_profile_flamegraph),
    "execute_table_query": seer_rpc(execute_table_query),
    "execute_timeseries_query": seer_rpc(execute_timeseries_query),
    "execute_trace_table_query": seer_rpc(execute_trace_table_query),
    "execute_replays_query": seer_rpc(execute_replays_query),
    "execute_issues_query": seer_rpc(execute_issues_query),
    "get_repository_definition": seer_rpc(get_repository_definition),
    "call_custom_tool": seer_rpc(call_custom_tool),
    "call_on_completion_hook": seer_rpc(call_on_completion_hook),
    "deliver_feature_result": seer_rpc(deliver_feature_result),
    "record_pr_attribution": seer_rpc(record_pr_attribution),
    "get_log_attributes_for_trace": seer_rpc(get_log_attributes_for_trace),
    "get_metric_attributes_for_trace": seer_rpc(get_metric_attributes_for_trace),
    "get_baseline_tag_distribution": seer_rpc(get_baseline_tag_distribution),
    "get_dsn": seer_rpc(get_dsn),
    #
    # Replays
    "get_replay_summary_logs": seer_rpc(rpc_get_replay_summary_logs),
    "get_replay_metadata": seer_rpc(get_replay_metadata),
    #
    # Issue Detection
    "create_issue_occurrence": seer_rpc(create_issue_occurrence),
    #
    # PR metrics (judge path)
    "update_pr_metrics": seer_rpc(update_pr_metrics),
    #
    # Monitoring provider tokens (MCP)
    "get_monitoring_provider_connections": seer_rpc(get_monitoring_provider_connections),
    "refresh_monitoring_provider_token": seer_rpc(refresh_monitoring_provider_token),
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
