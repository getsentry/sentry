import hashlib
import hmac
import logging
import typing
from collections.abc import Callable
from typing import Any, cast

import pydantic
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import AuthenticationSiloLimit, StandardAuthentication
from sentry.api.base import Endpoint, internal_region_silo_endpoint
from sentry.hybridcloud.rpc.service import RpcAuthenticationSetupException
from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError, SCMError, SCMProviderException
from sentry.scm.types import PROVIDER_SET, ProviderName
from sentry.silo.base import SiloMode

logger = logging.getLogger(__name__)


def generate_request_signature(url_path: str, body: bytes) -> str:
    """
    Generate a signature for the request body
    with the first shared secret. If there are other
    shared secrets in the list they are only to be used
    for verification during key rotation.
    """
    if not settings.SCM_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot sign RPC requests without SCM_RPC_SHARED_SECRET"
        )

    signature_input = body
    secret = settings.SCM_RPC_SHARED_SECRET[0]
    signature = hmac.new(secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"


@AuthenticationSiloLimit(SiloMode.CONTROL, SiloMode.REGION)
class ScmRpcSignatureAuthentication(StandardAuthentication):
    """
    Authentication for SCM RPC requests.
    Requests are sent with an HMAC signed by a shared private key.
    """

    token_name = b"rpcsignature"

    def accepts_auth(self, auth: list[bytes]) -> bool:
        if not auth or len(auth) < 2:
            return False
        return auth[0].lower() == self.token_name

    def authenticate_token(self, request: Request, token: str) -> tuple[Any, Any]:
        signature_validation_error = get_signature_validation_error(
            request.path_info, request.body, token
        )
        if signature_validation_error:
            raise AuthenticationFailed(
                {
                    "errors": [
                        {
                            "details": f"SCM RPC signature validation failed: {signature_validation_error}"
                        }
                    ]
                }
            )

        sentry_sdk.get_isolation_scope().set_tag("scm_rpc_auth", True)

        return (AnonymousUser(), token)


def get_signature_validation_error(url: str, body: bytes, signature: str) -> str | None:
    """
    Compare request data + signature signed by one of the shared secrets.

    Once a key has been able to validate the signature other keys will
    not be attempted. We should only have multiple keys during key rotations.
    """
    if not settings.SCM_RPC_SHARED_SECRET:
        raise RpcAuthenticationSetupException(
            "Cannot validate RPC request signatures without SCM_RPC_SHARED_SECRET"
        )

    signature_parts = signature.split(":", 1)
    if len(signature_parts) != 2:
        return "invalid signature format"

    signature_prefix, signature_data = signature_parts

    if signature_prefix != "rpc0":
        return "invalid signature prefix"

    if not body:
        return "no body"

    for key in settings.SCM_RPC_SHARED_SECRET:
        computed = hmac.new(key.encode(), body, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(computed.encode(), signature_data.encode())
        if is_valid:
            return None

    return "wrong secret"


class RequestData(pydantic.BaseModel, extra=pydantic.Extra.allow):
    class Args(pydantic.BaseModel, extra=pydantic.Extra.allow):
        organization_id: int

        class CompositeRepositoryId(pydantic.BaseModel, extra=pydantic.Extra.forbid):
            provider: str
            external_id: str

        repository_id: int | CompositeRepositoryId

        def get_extra_fields(self) -> dict[str, Any]:
            return {k: v for k, v in self.__dict__.items() if k not in self.__fields__}

    args: Args


@internal_region_silo_endpoint
class ScmRpcServiceEndpoint(Endpoint):
    """
    RPC endpoint for SCM interactions. Authenticated with a shared secret.
    Copied from the normal rpc endpoint and modified for use with SCM.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODING_WORKFLOWS
    authentication_classes = (ScmRpcSignatureAuthentication,)
    permission_classes = ()
    enforce_rate_limit = False

    @staticmethod
    @sentry_sdk.trace
    def _is_authorized(request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, ScmRpcSignatureAuthentication
        ):
            return True
        return False

    @staticmethod
    @sentry_sdk.trace
    def _dispatch_to_source_code_manager(method_name: str, raw_request_data: dict[str, Any]) -> Any:
        method = scm_method_registry.get(method_name)
        if method is None:
            raise NotFound({"errors": [{"details": f"Unknown RPC method {method_name!r}"}]})

        try:
            request = RequestData.parse_obj(raw_request_data)
        except pydantic.ValidationError as ex:
            # 'typing.cast' required because Pydantic V1 still uses typing_extensions.TypeDict, which MyPy does not recognize as a dict.
            raise ValidationError(
                {"errors": typing.cast(list[dict[str, Any]], ex.errors())}
            ) from ex

        organization_id = request.args.organization_id

        repository_id: int | tuple[str, str]
        if isinstance(request.args.repository_id, RequestData.Args.CompositeRepositoryId):
            if request.args.repository_id.provider not in PROVIDER_SET:
                raise SCMCodedError(code="unknown_provider")

            repository_id = (
                cast(ProviderName, request.args.repository_id.provider),
                request.args.repository_id.external_id,
            )
        else:
            repository_id = request.args.repository_id

        scm = SourceCodeManager.make_from_repository_id(organization_id, repository_id)

        try:
            return method(scm, **request.args.get_extra_fields())
        except TypeError as e:
            raise ValidationError(
                {"errors": [{"details": f"Error calling method {method_name}: {str(e)}"}]}
            ) from e

    @sentry_sdk.trace
    def post(self, request: Request, method_name: str) -> Response:
        sentry_sdk.set_tag("rpc.method", method_name)

        if not self._is_authorized(request):
            raise PermissionDenied()

        try:
            result = self._dispatch_to_source_code_manager(method_name, request.data)
        except SCMCodedError as e:
            sentry_sdk.capture_exception()
            return Response(
                data={"errors": [{"type": "SCMCodedError", "details": self._make_details(e)}]},
                status=400,
            )
        except SCMProviderException as e:
            sentry_sdk.capture_exception()
            return Response(
                data={
                    "errors": [{"type": "SCMProviderException", "details": self._make_details(e)}]
                },
                status=503,
            )
        except SCMError as e:
            sentry_sdk.capture_exception()
            return Response(
                data={"errors": [{"type": "SCMError", "details": self._make_details(e)}]},
                status=500,
            )
        except Exception:
            sentry_sdk.capture_exception()
            raise
        else:
            return Response(data={"data": result})

    def _make_details(self, e: BaseException) -> list[Any]:
        details = list(e.args)
        while e.__cause__:
            e = e.__cause__
            details.extend(e.args)
        return details


scm_method_registry: dict[str, Callable] = {
    # These callables must accept a SourceCodeManager as their first argument,
    # and then they are free to accept any other **kwargs they want.
    # Their return type must be JSON-serializable.
    #
    # This dict could be populated dynamically by scanning the SourceCodeManager class for methods.
    # Explicit listing give us more control: we can rename methods,
    # delay exposing them as RPC, adapt their interface, etc.
    #
    # If a method of SourceCodeManager accepts only JSON-serializable arguments, by names, and
    # returns a JSON-serializable type, then it can be listed here directly.
    # Else, an adapter function must be used.
    "can_v1": SourceCodeManager.can,
    "get_issue_comments_v1": SourceCodeManager.get_issue_comments,
    "create_issue_comment_v1": SourceCodeManager.create_issue_comment,
    "delete_issue_comment_v1": SourceCodeManager.delete_issue_comment,
    "get_pull_request_v1": SourceCodeManager.get_pull_request,
    "get_pull_request_comments_v1": SourceCodeManager.get_pull_request_comments,
    "create_pull_request_comment_v1": SourceCodeManager.create_pull_request_comment,
    "delete_pull_request_comment_v1": SourceCodeManager.delete_pull_request_comment,
    "get_issue_comment_reactions_v1": SourceCodeManager.get_issue_comment_reactions,
    "create_issue_comment_reaction_v1": SourceCodeManager.create_issue_comment_reaction,
    "delete_issue_comment_reaction_v1": SourceCodeManager.delete_issue_comment_reaction,
    "get_pull_request_comment_reactions_v1": SourceCodeManager.get_pull_request_comment_reactions,
    "create_pull_request_comment_reaction_v1": SourceCodeManager.create_pull_request_comment_reaction,
    "delete_pull_request_comment_reaction_v1": SourceCodeManager.delete_pull_request_comment_reaction,
    "get_issue_reactions_v1": SourceCodeManager.get_issue_reactions,
    "create_issue_reaction_v1": SourceCodeManager.create_issue_reaction,
    "delete_issue_reaction_v1": SourceCodeManager.delete_issue_reaction,
    "get_pull_request_reactions_v1": SourceCodeManager.get_pull_request_reactions,
    "create_pull_request_reaction_v1": SourceCodeManager.create_pull_request_reaction,
    "delete_pull_request_reaction_v1": SourceCodeManager.delete_pull_request_reaction,
    "get_branch_v1": SourceCodeManager.get_branch,
    "create_branch_v1": SourceCodeManager.create_branch,
    "update_branch_v1": SourceCodeManager.update_branch,
    "create_git_blob_v1": SourceCodeManager.create_git_blob,
    "get_file_content_v1": SourceCodeManager.get_file_content,
    "get_commit_v1": SourceCodeManager.get_commit,
    "get_commits_v1": SourceCodeManager.get_commits,
    "compare_commits_v1": SourceCodeManager.compare_commits,
    "get_tree_v1": SourceCodeManager.get_tree,
    "get_git_commit_v1": SourceCodeManager.get_git_commit,
    "create_git_tree_v1": SourceCodeManager.create_git_tree,
    "create_git_commit_v1": SourceCodeManager.create_git_commit,
    "get_pull_request_files_v1": SourceCodeManager.get_pull_request_files,
    "get_pull_request_commits_v1": SourceCodeManager.get_pull_request_commits,
    "get_pull_request_diff_v1": SourceCodeManager.get_pull_request_diff,
    "get_pull_requests_v1": SourceCodeManager.get_pull_requests,
    "create_pull_request_v1": SourceCodeManager.create_pull_request,
    "update_pull_request_v1": SourceCodeManager.update_pull_request,
    "request_review_v1": SourceCodeManager.request_review,
    "create_review_comment_file_v1": SourceCodeManager.create_review_comment_file,
    "create_review_comment_reply_v1": SourceCodeManager.create_review_comment_reply,
    "create_review_v1": SourceCodeManager.create_review,
    "create_check_run_v1": SourceCodeManager.create_check_run,
    "get_check_run_v1": SourceCodeManager.get_check_run,
    "update_check_run_v1": SourceCodeManager.update_check_run,
    "minimize_comment_v1": SourceCodeManager.minimize_comment,
}
