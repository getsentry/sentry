import hashlib
import hmac
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import orjson
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    ParseError,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope, capture_exception
from snuba_sdk import BooleanCondition, BooleanOp, Column, Condition, Entity, Function, Op, Query
from snuba_sdk import Request as SnubaRequest

from sentry import eventstore, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException, RpcResolutionException
from sentry.hybridcloud.rpc.sig import SerializableFunctionValueException
from sentry.integrations.github.constants import STACKFRAME_COUNT
from sentry.integrations.github.tasks.language_parsers import (
    PATCH_PARSERS,
    LanguageParser,
    SimpleLanguageParser,
)
from sentry.integrations.github.tasks.open_pr_comment import (
    MAX_RECENT_ISSUES,
    get_projects_and_filenames_from_source_file,
)
from sentry.integrations.github.tasks.utils import PullRequestFile
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.env import in_test_environment
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


MAX_NUM_ISSUES = 5


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
    signature_input = b"%s:%s" % (
        url.encode(),
        body,
    )

    for key in settings.SEER_RPC_SHARED_SECRET:
        computed = hmac.new(key.encode(), signature_input, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
        if is_valid:
            return True

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


def _get_issues_for_file(
    projects: list[Project],
    sentry_filenames: list[str],
    function_names: list[str],
    max_num_issues: int = MAX_NUM_ISSUES,
) -> list[dict[str, Any]]:
    """
    Fetch issues with their latest event if its stacktrace frames match the function names
    and file names.
    """
    if not len(projects):
        return []

    patch_parsers: dict[str, LanguageParser | SimpleLanguageParser] = PATCH_PARSERS

    # Gets the appropriate parser for formatting the snuba query given the file extension.
    # The extension is never replaced in reverse codemapping.
    file_extension = sentry_filenames[0].split(".")[-1]
    language_parser = patch_parsers.get(file_extension, None)

    if not language_parser:
        return []

    # Fetch an initial, candidate set of groups.
    group_ids: list[int] = list(
        Group.objects.filter(
            first_seen__gte=datetime.now(UTC) - timedelta(days=90),
            last_seen__gte=datetime.now(UTC) - timedelta(days=14),
            status=GroupStatus.UNRESOLVED,
            project__in=projects,
        )
        .order_by("-times_seen")
        .values_list("id", flat=True)
    )[:MAX_RECENT_ISSUES]
    project_ids = [project.id for project in projects]
    multi_if = language_parser.generate_multi_if(function_names)

    # Fetch the latest event for each group, along with some other event data we'll need for
    # filtering by function names and file names.
    subquery = (
        Query(Entity("events"))
        .set_select(
            [
                Column("group_id"),
                Function(
                    "argMax",
                    [Column("event_id"), Column("timestamp")],
                    "event_id",
                ),
                Function(
                    "argMax",
                    [Column("title"), Column("timestamp")],
                    "title",
                ),
                Function(
                    "argMax",
                    [Column("exception_frames.filename"), Column("timestamp")],
                    "exception_frames.filename",
                ),
                Function(
                    "argMax",
                    [Column("exception_frames.function"), Column("timestamp")],
                    "exception_frames.function",
                ),
            ]
        )
        .set_groupby(
            [
                Column("group_id"),
            ]
        )
        .set_where(
            [
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("group_id"), Op.IN, group_ids),
                Condition(
                    Function("toStartOfDay", [Column("timestamp")]),
                    Op.GTE,
                    datetime.now().date() - timedelta(days=14),
                ),
                Condition(
                    Function("toStartOfDay", [Column("timestamp")]),
                    Op.LT,
                    datetime.now().date() + timedelta(days=1),
                ),
                # Apply toStartOfDay to take advantage of the sorting key. TODO: measure.
                # Then, for precision, add the granular timestamp filters:
                Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                Condition(Function("notHandled", []), Op.EQ, 1),
            ]
        )
    )

    # Filter out groups whose event's stacktrace doesn't match the function names and file names.
    query = (
        Query(subquery)
        .set_select(
            [
                Column("group_id"),
                Column("event_id"),
                Column("title"),
                Function("multiIf", multi_if, "function_name"),
            ]
        )
        .set_where(
            [
                BooleanCondition(
                    BooleanOp.OR,
                    [
                        BooleanCondition(
                            BooleanOp.AND,
                            [
                                Condition(
                                    Function(
                                        "arrayElement",
                                        (Column("exception_frames.filename"), stackframe_idx),
                                    ),
                                    Op.IN,
                                    sentry_filenames,
                                ),
                                language_parser.generate_function_name_conditions(
                                    function_names, stackframe_idx
                                ),
                            ],
                        )
                        for stackframe_idx in range(-STACKFRAME_COUNT, 0)  # first n frames
                    ],
                ),
            ]
        )
        .set_limit(max_num_issues)  # TODO: order by something? Should be made reproducible.
    )
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": projects[0].organization_id},
        query=query,
    )
    # TODO: error handling.
    return raw_snql_query(request, referrer=Referrer.SEER_RPC.value)["data"]


def _add_event_details(
    projects: list[Project],
    issues_result_set: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Bulk-fetch the events corresponding to the issues, and bulk-serialize them.
    """
    project_ids = [project.id for project in projects]
    event_ids = [group_dict["event_id"] for group_dict in issues_result_set]
    event_filter = eventstore.Filter(event_ids=event_ids, project_ids=project_ids)
    events = eventstore.backend.get_events(
        filter=event_filter,
        referrer=Referrer.SEER_RPC.value,
        tenant_ids={"organization_id": projects[0].organization_id},
    )
    serialized_events = serialize(events, serializer=EventSerializer())
    return [
        {
            "id": group_dict["group_id"],
            "title": group_dict["title"],
            "function_name": group_dict["function_name"],
            "events": [serialized_event],
        }
        for group_dict, serialized_event in zip(issues_result_set, serialized_events, strict=True)
    ]


def get_issues_with_event_details_for_file(
    projects: list[Project],
    sentry_filenames: list[str],
    function_names: list[str],
    max_num_issues: int = MAX_NUM_ISSUES,
) -> list[dict[str, Any]]:
    issues_result_set = _get_issues_for_file(
        projects, sentry_filenames, function_names, max_num_issues=max_num_issues
    )
    return _add_event_details(projects, issues_result_set)


def get_issues_related_to_file_patches(
    *,
    organization_id: int,
    provider: str,
    external_id: str,
    filename_to_patch: dict[str, str],
    max_num_issues: int = MAX_NUM_ISSUES,
) -> dict[str, list[dict[str, Any]]]:
    """
    Get the top issues related to each file by looking at matches between functions in the patch
    and functions in the issue's event's stacktrace.

    Each issue includes its latest serialized event.
    """

    try:
        repo = Repository.objects.get(
            organization_id=organization_id, provider=provider, external_id=external_id
        )
    except Repository.DoesNotExist:
        logger.exception(
            "Repo doesn't exist",
            extra={
                "organization_id": organization_id,
                "provider": provider,
                "external_id": external_id,
            },
        )
        return {}

    repo_id = repo.id

    pullrequest_files = [
        PullRequestFile(filename=filename, patch=patch)
        for filename, patch in filename_to_patch.items()
    ]

    filename_to_issues = {}
    patch_parsers: dict[str, LanguageParser | SimpleLanguageParser] = PATCH_PARSERS

    for file in pullrequest_files:
        projects, sentry_filenames = get_projects_and_filenames_from_source_file(
            organization_id, repo_id, file.filename
        )
        if not len(projects) or not len(sentry_filenames):
            # TODO: metrics like in open_pr_comment?
            logger.error("No projects or filenames", extra={"file": file.filename})
            continue

        file_extension = file.filename.split(".")[-1]
        language_parser = patch_parsers.get(file_extension, None)
        if not language_parser:
            logger.error("No language parser", extra={"file": file.filename})
            continue

        function_names = language_parser.extract_functions_from_patch(file.patch)
        if not len(function_names):
            logger.error("No function names", extra={"file": file.filename})
            continue

        issues = get_issues_with_event_details_for_file(
            list(projects),
            list(sentry_filenames),
            list(function_names),
            max_num_issues=max_num_issues,
        )
        filename_to_issues[file.filename] = issues

    return filename_to_issues


seer_method_registry: dict[str, Callable[..., dict[str, Any]]] = {
    "get_organization_slug": get_organization_slug,
    "get_organization_autofix_consent": get_organization_autofix_consent,
    "get_issues_related_to_file_patches": get_issues_related_to_file_patches,
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

    signature_input = b"%s:%s" % (
        url_path.encode("utf8"),
        body,
    )
    secret = settings.SEER_RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"
