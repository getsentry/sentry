import datetime
import hashlib
import hmac
import logging
from collections.abc import Callable
from typing import Any

import orjson
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
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_sdk import Scope, capture_exception

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.endpoints.organization_trace_item_attributes import as_attribute_key
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.models.organization import Organization
from sentry.search.eap.types import SupportedTraceItemType
from sentry.seer.autofix_tools import get_error_event_details, get_profile_details
from sentry.seer.fetch_issues.fetch_issues import (
    get_issues_related_to_file_patches,
    get_issues_related_to_function_names,
)
from sentry.silo.base import SiloMode
from sentry.utils import snuba_rpc
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
        return False

    # We aren't using the version bits currently.
    body = orjson.dumps(orjson.loads(body))
    _, signature_data = signature.split(":", 2)
    # TODO: For backward compatibility with the current Seer implementation, allow all signatures
    # while we deploy the fix to both services
    return True

    # signature_input = body

    # for key in settings.SEER_RPC_SHARED_SECRET:
    #     computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
    #     is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
    #     if is_valid:
    #         return True

    # return False


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

        Scope.get_isolation_scope().set_tag("seer_rpc_auth", True)

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
            capture_exception()
            raise NotFound from e
        except SerializableFunctionValueException as e:
            capture_exception()
            raise ParseError from e
        except ObjectDoesNotExist as e:
            # Let this fall through, this is normal.
            capture_exception()
            raise NotFound from e
        except Exception as e:
            if in_test_environment():
                raise
            if settings.DEBUG:
                raise Exception(f"Problem processing seer rpc endpoint {method_name}") from e
            capture_exception()
            raise ValidationError from e
        return Response(data=result)


def get_organization_slug(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    return {"slug": org.slug}


def get_organization_autofix_consent(*, org_id: int) -> dict:
    org: Organization = Organization.objects.get(id=org_id)
    consent = org.get_option("sentry:gen_ai_consent_v2024_11_14", False)
    github_extension_enabled = org_id in options.get("github-extension.enabled-orgs")
    return {
        "consent": consent or github_extension_enabled,
    }


def get_fields(*, org_id: int, project_ids: list[int], stats_period: str) -> dict:
    # organization = Organization.objects.get(id=org_id)
    # projects = Project.objects.filter(id__in=project_ids, organization=organization, status=0)

    # return {"fields": ["op"]}

    # org: Organization = Organization.objects.get(id=org_id)
    # print("slug", org.slug)

    field_types = [
        (AttributeKey.Type.TYPE_STRING, "string"),
        (AttributeKey.Type.TYPE_DOUBLE, "number"),
    ]

    # TODO: Start based off stats period
    start = datetime.datetime.now() - datetime.timedelta(days=7)
    end = datetime.datetime.now()

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    fields = []

    for attr_type, field_type in field_types:
        req = TraceItemAttributeNamesRequest(
            meta=RequestMeta(
                organization_id=org_id,
                cogs_category="events_analytics_platform",
                referrer="seer_rpc",
                project_ids=project_ids,
                start_timestamp=start_time_proto,
                end_timestamp=end_time_proto,
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            ),
            type=attr_type,
            limit=1000,
        )

        fields_resp = snuba_rpc.attribute_names_rpc(req)

        # print("attributes", fields_resp.attributes)

        # for attr in fields_resp.attributes:
        #     print("attr", attr)
        #     print("name", attr.name)
        #     print("type", attr.type)
        #     print("as key", as_attribute_key(attr.name, field_type, SupportedTraceItemType.SPANS))

        parsed_fields = [
            {
                "key": as_attribute_key(
                    attr.name,
                    "string" if field_type == "string" else "number",
                    SupportedTraceItemType.SPANS,
                )["key"],
                "name": attr.name,
                "type": attr_type,
            }
            for attr in fields_resp.attributes
        ]

        fields.extend(parsed_fields)

    return {"fields": fields}


def get_field_values(
    *,
    fields: list[dict[str, Any]],
    org_id: int,
    project_ids: list[int],
    stats_period: str,
    k: int = 100,
) -> dict:

    # TODO: Start based off stats period
    start = datetime.datetime.now() - datetime.timedelta(days=7)
    end = datetime.datetime.now()

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    values = []

    for field in fields:
        # Construct proper AttributeKey object
        attr_key = AttributeKey(
            name=field["name"],
            type=field["type"],
        )

        req = TraceItemAttributeValuesRequest(
            meta=RequestMeta(
                organization_id=org_id,
                cogs_category="events_analytics_platform",
                referrer="seer_rpc",
                project_ids=project_ids,
                start_timestamp=start_time_proto,
                end_timestamp=end_time_proto,
                trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
            ),
            key=attr_key,
            limit=k,
        )

        # print("key requesting a value", attr_key)

        values_response = snuba_rpc.attribute_values_rpc(req)
        # values_response = values_response.data

        # print("values_response", values_response)

        # values_parsed = []

        values.append(values_response)

    return {"values": values}


seer_method_registry: dict[str, Callable[..., dict[str, Any]]] = {
    "get_organization_slug": get_organization_slug,
    "get_organization_autofix_consent": get_organization_autofix_consent,
    "get_issues_related_to_file_patches": get_issues_related_to_file_patches,
    "get_issues_related_to_function_names": get_issues_related_to_function_names,
    "get_error_event_details": get_error_event_details,
    "get_profile_details": get_profile_details,
    "get_fields": get_fields,
    "get_field_values": get_field_values,
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
