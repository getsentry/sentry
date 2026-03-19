from typing import Any, Callable, cast

import pydantic

from sentry.scm.actions import (
    SourceCodeManager,
    compare_commits,
    create_branch,
    create_check_run,
    create_git_blob,
    create_git_commit,
    create_git_tree,
    create_issue_comment,
    create_issue_comment_reaction,
    create_issue_reaction,
    create_pull_request,
    create_pull_request_comment,
    create_pull_request_comment_reaction,
    create_pull_request_draft,
    create_pull_request_reaction,
    create_review,
    create_review_comment_file,
    create_review_comment_reply,
    delete_issue_comment,
    delete_issue_comment_reaction,
    delete_issue_reaction,
    delete_pull_request_comment,
    delete_pull_request_comment_reaction,
    delete_pull_request_reaction,
    get_archive_link,
    get_branch,
    get_check_run,
    get_commit,
    get_commits,
    get_commits_by_path,
    get_file_content,
    get_git_commit,
    get_issue_comment_reactions,
    get_issue_comments,
    get_issue_reactions,
    get_pull_request,
    get_pull_request_comment_reactions,
    get_pull_request_comments,
    get_pull_request_commits,
    get_pull_request_diff,
    get_pull_request_files,
    get_pull_request_reactions,
    get_pull_requests,
    get_tree,
    minimize_comment,
    request_review,
    update_branch,
    update_check_run,
    update_pull_request,
)
from sentry.scm.errors import (
    SCMProviderNotSupported,
    SCMRpcActionCallError,
    SCMRpcActionNotFound,
    SCMRpcCouldNotDeserializeRequest,
)
from sentry.scm.types import PROVIDER_SET, ProviderName


def dispatch(action_name: str, raw_request_data: dict[str, Any]):
    """
    Dispatch an RPC request.

    Action arguments are yolo'd for now. Better type-safety and error messages will be introduced
    later. Our dedicated client should make this less of a practical concern.
    """
    if action_name not in scm_action_registry:
        raise SCMRpcActionNotFound(action_name)

    try:
        request = RequestData.parse_obj(raw_request_data)
    except pydantic.ValidationError as e:
        raise SCMRpcCouldNotDeserializeRequest(e.errors()) from e

    organization_id = request.args.organization_id

    repository_id: int | tuple[str, str]
    if isinstance(request.args.repository_id, RequestData.Args.CompositeRepositoryId):
        if request.args.repository_id.provider not in PROVIDER_SET:
            raise SCMProviderNotSupported(
                f"{request.args.repository_id.provider} is not supported."
            )

        repository_id = (
            cast(ProviderName, request.args.repository_id.provider),
            request.args.repository_id.external_id,
        )
    else:
        repository_id = request.args.repository_id

    scm = SourceCodeManager.make_from_repository_id(organization_id, repository_id)

    try:
        return scm_action_registry[action_name](scm, **request.args.get_extra_fields())
    except AttributeError:
        raise SCMProviderNotSupported(
            f"{action_name} is not supported by service-provider {scm.provider.__class__.__name__}"
        )
    except TypeError as e:
        raise SCMRpcActionCallError(action_name, str(e)) from e


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


scm_action_registry: dict[str, Callable] = {
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
    "compare_commits_v1": compare_commits,
    "create_branch_v1": create_branch,
    "create_check_run_v1": create_check_run,
    "create_git_blob_v1": create_git_blob,
    "create_git_commit_v1": create_git_commit,
    "create_git_tree_v1": create_git_tree,
    "create_issue_comment_reaction_v1": create_issue_comment_reaction,
    "create_issue_comment_v1": create_issue_comment,
    "create_issue_reaction_v1": create_issue_reaction,
    "create_pull_request_comment_reaction_v1": create_pull_request_comment_reaction,
    "create_pull_request_comment_v1": create_pull_request_comment,
    "create_pull_request_draft_v1": create_pull_request_draft,
    "create_pull_request_reaction_v1": create_pull_request_reaction,
    "create_pull_request_v1": create_pull_request,
    "create_review_comment_file_v1": create_review_comment_file,
    "create_review_comment_reply_v1": create_review_comment_reply,
    "create_review_v1": create_review,
    "delete_issue_comment_reaction_v1": delete_issue_comment_reaction,
    "delete_issue_comment_v1": delete_issue_comment,
    "delete_issue_reaction_v1": delete_issue_reaction,
    "delete_pull_request_comment_reaction_v1": delete_pull_request_comment_reaction,
    "delete_pull_request_comment_v1": delete_pull_request_comment,
    "delete_pull_request_reaction_v1": delete_pull_request_reaction,
    "get_branch_v1": get_branch,
    "get_check_run_v1": get_check_run,
    "get_commit_v1": get_commit,
    "get_commits_by_path_v1": get_commits_by_path,
    "get_commits_v1": get_commits,
    "get_file_content_v1": get_file_content,
    "get_git_commit_v1": get_git_commit,
    "get_issue_comment_reactions_v1": get_issue_comment_reactions,
    "get_issue_comments_v1": get_issue_comments,
    "get_issue_reactions_v1": get_issue_reactions,
    "get_pull_request_comment_reactions_v1": get_pull_request_comment_reactions,
    "get_pull_request_comments_v1": get_pull_request_comments,
    "get_pull_request_commits_v1": get_pull_request_commits,
    "get_pull_request_diff_v1": get_pull_request_diff,
    "get_pull_request_files_v1": get_pull_request_files,
    "get_pull_request_reactions_v1": get_pull_request_reactions,
    "get_pull_request_v1": get_pull_request,
    "get_pull_requests_v1": get_pull_requests,
    "get_tree_v1": get_tree,
    "minimize_comment_v1": minimize_comment,
    "request_review_v1": request_review,
    "update_branch_v1": update_branch,
    "update_check_run_v1": update_check_run,
    "update_pull_request_v1": update_pull_request,
    "get_archive_link_v1": get_archive_link,
}
