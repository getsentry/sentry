import datetime
import hashlib
import hmac
import logging
from collections.abc import Callable
from typing import Any

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeValuesRequest,
)
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.organization_trace_item_attributes import as_attribute_key
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute
from sentry.search.events.types import SnubaParams
from sentry.seer.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.fetch_issues.fetch_issues import (
    get_issues_related_to_file_patches,
    get_issues_related_to_function_names,
)
from sentry.seer.fetch_issues.fetch_issues_given_exception_type import (
    get_issues_related_to_exception_type,
)
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.silo.base import SiloMode
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc
from sentry.utils.dates import parse_stats_period
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


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


@region_silo_endpoint
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

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, SeerRpcSignatureAuthentication
        ):
            return True
        return False

    def _dispatch_to_local_method(self, method_name: str, arguments: dict[str, Any]) -> Any:
        if method_name not in seer_method_registry:
            raise RpcResolutionException(f"Unknown method {method_name}")
        # As seer is a single service, we just directly expose the methods instead of services.
        method = seer_method_registry[method_name]
        return method(**arguments)

    def post(self, request: Request, method_name: str) -> Response:
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


def get_organization_autofix_consent(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    seer_org_acknowledgement = get_seer_org_acknowledgement(org_id=org.id)
    github_extension_enabled = org_id in options.get("github-extension.enabled-orgs")
    return {
        "consent": seer_org_acknowledgement or github_extension_enabled,
    }


def get_organization_seer_consent_by_org_name(
    *, org_name: str, provider: str = "github"
) -> dict[str, bool]:
    org_integrations = integration_service.get_organization_integrations(
        providers=[provider], name=org_name
    )

    for org_integration in org_integrations:
        try:
            org = Organization.objects.get(id=org_integration.organization_id)
            seer_org_acknowledgement = get_seer_org_acknowledgement(org_id=org.id)
            github_extension_enabled = org.id in options.get("github-extension.enabled-orgs")

            if seer_org_acknowledgement or github_extension_enabled:
                return {"consent": True}

        except Organization.DoesNotExist:
            continue

    return {"consent": False}


def get_attribute_names(*, org_id: int, project_ids: list[int], stats_period: str) -> dict:
    field_types = [
        AttributeKey.Type.TYPE_STRING,
        AttributeKey.Type.TYPE_DOUBLE,
    ]

    period = parse_stats_period(stats_period)
    if period is None:
        period = datetime.timedelta(days=7)

    end = datetime.datetime.now()
    start = end - period

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    fields = []

    for attr_type in field_types:
        req = TraceItemAttributeNamesRequest(
            meta=RequestMeta(
                organization_id=org_id,
                cogs_category="events_analytics_platform",
                referrer=Referrer.SEER_RPC.value,
                project_ids=project_ids,
                start_timestamp=start_time_proto,
                end_timestamp=end_time_proto,
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            ),
            type=attr_type,
            limit=1000,
        )

        fields_resp = snuba_rpc.attribute_names_rpc(req)

        parsed_fields = [
            as_attribute_key(
                attr.name,
                "string" if attr_type == AttributeKey.Type.TYPE_STRING else "number",
                SupportedTraceItemType.SPANS,
            )["key"]
            for attr in fields_resp.attributes
            if attr.name and can_expose_attribute(attr.name, SupportedTraceItemType.SPANS)
        ]
        fields.extend(parsed_fields)

    return {"fields": fields}


def get_attribute_values(
    *,
    fields: list[str],
    org_id: int,
    project_ids: list[int],
    stats_period: str,
    limit: int = 100,
) -> dict:
    period = parse_stats_period(stats_period)
    if period is None:
        period = datetime.timedelta(days=7)

    end = datetime.datetime.now()
    start = end - period

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    values = {}
    resolver = SearchResolver(
        params=SnubaParams(
            start=start,
            end=end,
        ),
        config=SearchResolverConfig(),
        definitions=SPAN_DEFINITIONS,
    )

    for field in fields:
        resolved_field, _ = resolver.resolve_attribute(field)
        if resolved_field.proto_definition.type == AttributeKey.Type.TYPE_STRING:

            req = TraceItemAttributeValuesRequest(
                meta=RequestMeta(
                    organization_id=org_id,
                    cogs_category="events_analytics_platform",
                    referrer=Referrer.SEER_RPC.value,
                    project_ids=project_ids,
                    start_timestamp=start_time_proto,
                    end_timestamp=end_time_proto,
                    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                ),
                key=resolved_field.proto_definition,
                limit=limit,
            )

            values_response = snuba_rpc.attribute_values_rpc(req)
            values[field] = [value for value in values_response.values]

    return {"values": values}


def get_attribute_values_with_substring(
    *,
    org_id: int,
    project_ids: list[int],
    fields_with_substrings: list[dict[str, str]],
    stats_period: str = "48h",
    limit: int = 100,
) -> dict:
    """
    Get attribute values with substring.
    Note: The RPC is guaranteed to not return duplicate values for the same field.
    ie: if span.description is requested with both null and "payment" substrings,
    the RPC will return the set of values for span.description to avoid duplicates.
    """
    values: dict[str, set[str]] = {}

    period = parse_stats_period(stats_period)
    if period is None:
        period = datetime.timedelta(days=7)

    end = datetime.datetime.now()
    start = end - period

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    resolver = SearchResolver(
        params=SnubaParams(
            start=start,
            end=end,
        ),
        config=SearchResolverConfig(),
        definitions=SPAN_DEFINITIONS,
    )

    for field_with_substring in fields_with_substrings:
        field = field_with_substring["field"]
        substring = field_with_substring["substring"]

        resolved_field, _ = resolver.resolve_attribute(field)
        if resolved_field.proto_definition.type == AttributeKey.Type.TYPE_STRING:
            req = TraceItemAttributeValuesRequest(
                meta=RequestMeta(
                    organization_id=org_id,
                    cogs_category="events_analytics_platform",
                    referrer=Referrer.SEER_RPC.value,
                    project_ids=project_ids,
                    start_timestamp=start_time_proto,
                    end_timestamp=end_time_proto,
                    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                ),
                key=resolved_field.proto_definition,
                limit=limit,
                value_substring_match=substring,
            )

            values_response = snuba_rpc.attribute_values_rpc(req)
            if field in values:
                values[field].update({value for value in values_response.values if value})
            else:
                values[field] = {value for value in values_response.values if value}

    return {"values": values}


def get_attributes_and_values(
    *,
    org_id: int,
    project_ids: list[int],
    stats_period: str,
    max_values: int = 100,
    max_attributes: int = 1000,
) -> dict:
    """
    Fetches all string attributes and the corresponding values with counts for a given period.
    """
    period = parse_stats_period(stats_period)
    if period is None:
        period = datetime.timedelta(days=7)

    end = datetime.datetime.now()
    start = end - period

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    meta = RequestMeta(
        organization_id=org_id,
        cogs_category="events_analytics_platform",
        referrer=Referrer.SEER_RPC.value,
        project_ids=project_ids,
        start_timestamp=start_time_proto,
        end_timestamp=end_time_proto,
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
    )

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

    attributes_and_values = [
        {
            attribute.attribute_name: [
                {"value": value.label, "count": value.value} for value in attribute.buckets
            ]
        }
        for result in rpc_response.results
        for attribute in result.attribute_distributions.attributes
        if attribute.buckets
    ]

    return {"attributes_and_values": attributes_and_values}


seer_method_registry: dict[str, Callable[..., dict[str, Any]]] = {
    "get_organization_slug": get_organization_slug,
    "get_organization_autofix_consent": get_organization_autofix_consent,
    "get_organization_seer_consent_by_org_name": get_organization_seer_consent_by_org_name,
    "get_issues_related_to_file_patches": get_issues_related_to_file_patches,
    "get_issues_related_to_function_names": get_issues_related_to_function_names,
    "get_issues_related_to_exception_type": get_issues_related_to_exception_type,
    "get_error_event_details": get_error_event_details,
    "get_profile_details": get_profile_details,
    "get_attribute_names": get_attribute_names,
    "get_attribute_values": get_attribute_values,
    "get_attribute_values_with_substring": get_attribute_values_with_substring,
    "get_attributes_and_values": get_attributes_and_values,
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
