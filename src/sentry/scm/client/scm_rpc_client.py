from __future__ import annotations

import hashlib
import hmac
from datetime import datetime
from typing import Any, TypedDict

import orjson
import pydantic
import requests

from .errors import SCMCodedError, SCMError, SCMProviderException, SCMUnhandledException
from .private import parsers
from .types import (
    SHA,
    ActionResult,
    BranchName,
    BuildConclusion,
    BuildStatus,
    CheckRun,
    CheckRunOutput,
    Comment,
    Commit,
    FileContent,
    GitBlob,
    GitCommitObject,
    GitRef,
    GitTree,
    InputTreeEntry,
    PaginatedActionResult,
    PaginatedResponseMeta,
    PaginationParams,
    ProviderName,
    PullRequest,
    PullRequestCommit,
    PullRequestFile,
    PullRequestState,
    Reaction,
    ReactionResult,
    RepositoryId,
    RequestOptions,
    ResourceId,
    ResponseMeta,
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewEvent,
    ReviewSide,
)

# Implementation details


def _generate_request_signature(shared_secret: str, url_path: str, body: bytes) -> str:
    signature_input = body
    signature = hmac.new(shared_secret.encode("utf-8"), signature_input, hashlib.sha256).hexdigest()
    return f"rpc0:{signature}"


class _CompositeRepositoryId(TypedDict):
    provider: str
    external_id: str


class _BasicArgs(TypedDict):
    organization_id: int
    repository_id: int | _CompositeRepositoryId


class _Error(pydantic.BaseModel):
    type: str
    details: list[Any]


class _ResponseBodyData(pydantic.BaseModel):
    data: Any
    type: ProviderName
    raw: Any
    meta: Any


class _ResponseBody(pydantic.BaseModel):
    data: _ResponseBodyData | bool | None | parsers.Unset = parsers.Unset.UNSET
    errors: list[_Error] | parsers.Unset = parsers.Unset.UNSET


class _ResponseMeta(pydantic.BaseModel):
    etag: str | parsers.Unset = parsers.Unset.UNSET
    last_modified: datetime | parsers.Unset = parsers.Unset.UNSET


class _PaginatedResponseMeta(pydantic.BaseModel):
    etag: str | parsers.Unset = parsers.Unset.UNSET
    last_modified: datetime | parsers.Unset = parsers.Unset.UNSET
    next_cursor: str | None


# Client interface


class SourceCodeManagerRPCClient:
    """
    base_url:
        E.g. "http://dev.getsentry.net:8000" (no trailing slash)

    shared_secret:
        The shared secret configured on the SCM RPC server side (SCM_RPC_SHARED_SECRET), used for authenticating requests

    organization_id:
        The Sentry organization ID that the SCM RPC requests will be made on behalf of

    repository_id:
        The repository ID that the SCM RPC requests will be made on.
        Either an internal integer repository ID, or (provider, external_id).

    session:
        You may pass in a `requests.Session` to the constructor if you want to manage the session lifecycle yourself
        (e.g. for connection pooling or custom configuration).
        If you do not pass in a session, the client will create its own session and manage its lifecycle internally.

        In both cases, you can call `.close()`. It will close the session if the client owns it,
        and do nothing if you passed in a session (since you manage its lifecycle).
        And in both cases, you can also use the client as a context manager, which will call `.close()` on exit.
    """

    # At the time of writing, the prefix is configured in:
    # - api/0: https://github.com/getsentry/sentry/blob/de54779095c3819213569ead2f28dfb6d0fe082e/src/sentry/web/urls.py#L178-L181
    # - internal: https://github.com/getsentry/sentry/blob/de54779095c3819213569ead2f28dfb6d0fe082e/src/sentry/api/urls.py#L3763-L3766
    # - scm-rpc: https://github.com/getsentry/sentry/blob/de54779095c3819213569ead2f28dfb6d0fe082e/src/sentry/api/urls.py#L3552-L3556
    API_PREFIX = "api/0/internal/scm-rpc"

    def __init__(
        self,
        *,
        base_url: str,
        shared_secret: str,
        organization_id: int,
        repository_id: RepositoryId,
        session: requests.Session | None = None,
    ) -> None:
        self._base_url = base_url
        assert not self._base_url.endswith("/"), "base_url should not have a trailing slash"
        self._shared_secret = shared_secret

        if isinstance(repository_id, int):
            self._basic_args = _BasicArgs(
                organization_id=organization_id,
                repository_id=repository_id,
            )
        else:
            self._basic_args = _BasicArgs(
                organization_id=organization_id,
                repository_id=_CompositeRepositoryId(
                    provider=repository_id[0],
                    external_id=repository_id[1],
                ),
            )

        if session is None:
            self._session = requests.Session()
            self._owns_session = True
        else:
            self._session = session
            self._owns_session = False

    def __enter__(self) -> SourceCodeManagerRPCClient:
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc_val: BaseException | None, exc_tb: Any
    ) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_session:
            self._session.close()

    class _Response:
        def __init__(self, response_: requests.Response):
            self.response = response_
            self.response_for_unhandled: Any = self.response.text

            try:
                response_json = self.response.json()
            except requests.exceptions.JSONDecodeError as e:
                raise self._unhandled("Response was not JSON") from e

            self.response_for_unhandled = response_json

            try:
                response_body = _ResponseBody.parse_obj(response_json)
            except pydantic.ValidationError as e:
                raise self._unhandled("Response did not match expected schema") from e

            if response_body.errors is not parsers.Unset.UNSET:
                exceptions: list[SCMError] = []
                for error in response_body.errors:
                    if error.type == "SCMCodedError":
                        exceptions.append(SCMCodedError(*error.details))
                    elif error.type == "SCMProviderException":
                        exceptions.append(SCMProviderException(*error.details))
                    elif error.type == "SCMError":
                        exceptions.append(SCMError(*error.details))
                    else:
                        exceptions.append(self._unhandled(f"Unknown error type: {error.type}"))
                if len(exceptions) == 1:
                    raise exceptions[0]
                else:
                    raise self._unhandled("Multiple errors returned")
            elif response_body.data is parsers.Unset.UNSET:
                raise self._unhandled("Response did not match expected schema")
            else:
                self.response_body_data = response_body.data

        def _unhandled(self, message: str) -> SCMUnhandledException:
            return SCMUnhandledException(
                message, self.response.status_code, self.response_for_unhandled
            )

        def _unhandled_return_type(self) -> SCMUnhandledException:
            return self._unhandled("Response data did not match expected return type")

        def to_list[T](
            self, item_parser: type[pydantic.BaseModel], item_type: type[T]
        ) -> PaginatedActionResult[T]:
            if not isinstance(self.response_body_data, _ResponseBodyData):
                raise self._unhandled_return_type()
            if not isinstance(self.response_body_data.data, list):
                raise self._unhandled_return_type()
            return PaginatedActionResult[T](
                data=[
                    self._convert_item(item, item_parser, item_type)
                    for item in self.response_body_data.data
                ],
                type=self.response_body_data.type,
                raw=self.response_body_data.raw,
                meta=self._convert_item(
                    self.response_body_data.meta, _PaginatedResponseMeta, PaginatedResponseMeta
                ),
            )

        def to_item[T](
            self, item_parser: type[pydantic.BaseModel], item_type: type[T]
        ) -> ActionResult[T]:
            if not isinstance(self.response_body_data, _ResponseBodyData):
                raise self._unhandled_return_type()
            return ActionResult[T](
                data=self._convert_item(self.response_body_data.data, item_parser, item_type),
                type=self.response_body_data.type,
                raw=self.response_body_data.raw,
                meta=self._convert_item(self.response_body_data.meta, _ResponseMeta, ResponseMeta),
            )

        def to_none(self) -> None:
            if self.response_body_data is not None:
                raise self._unhandled_return_type()
            return None

        def to_string(self) -> ActionResult[str]:
            if not isinstance(self.response_body_data, _ResponseBodyData):
                raise self._unhandled_return_type()
            if not isinstance(self.response_body_data.data, str):
                raise self._unhandled_return_type()
            return ActionResult[str](
                data=self.response_body_data.data,
                type=self.response_body_data.type,
                raw=self.response_body_data.raw,
                meta=self._convert_item(self.response_body_data.meta, _ResponseMeta, ResponseMeta),
            )

        def to_bool(self) -> bool:
            if not isinstance(self.response_body_data, bool):
                raise self._unhandled_return_type()
            return self.response_body_data

        def _convert_item[T](
            self, item: Any, item_parser: type[pydantic.BaseModel], item_type: type[T]
        ) -> T:
            try:
                parsed = pydantic.parse_obj_as(item_parser, item)
            except pydantic.ValidationError as e:
                raise self._unhandled_return_type() from e
            return item_type(
                **{k: v for (k, v) in parsed.dict().items() if v is not parsers.Unset.UNSET}
            )

    def _call(self, method: str, method_args: dict[str, Any]) -> _Response:
        url = f"{self._base_url}/{self.API_PREFIX}/{method}/"
        body = orjson.dumps({"args": self._basic_args | method_args})
        signature = _generate_request_signature(self._shared_secret, url, body=body)
        headers = {
            "Authorization": f"rpcsignature {signature}",
            "Content-Type": "application/json",
        }
        return self._Response(self._session.post(url, data=body, headers=headers))

    def can(self, actions: list[str]) -> bool:
        """
        Returns true if the SourceCodeManager can execute a set of actions against a target API.

        Interactions with source code management services are not transactional. There are many
        failure points in the process and partial states are a reality that must be handled. One
        common failure mode is a mismatch of expectations between what the SCM supports and what a
        SCM provider can actually accommodate. By asking up front, "can the provider for this
        customer accommodate all the actions I need to execute?" a developer can eagerly exit or
        alter some behavior when we know the request will fail deterministically. This eliminates
        the need to clean-up side-effects after a partially implemented SCM provider fails.
        """
        return self._call("can_v1", {"actions": actions}).to_bool()

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on an issue."""
        return self._call(
            "get_issue_comments_v1",
            {"issue_id": issue_id, "pagination": pagination, "request_options": request_options},
        ).to_list(parsers.Comment, Comment)

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on an issue."""
        return self._call("create_issue_comment_v1", {"issue_id": issue_id, "body": body}).to_item(
            parsers.Comment, Comment
        )

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        """Delete a comment on an issue."""
        return self._call(
            "delete_issue_comment_v1", {"issue_id": issue_id, "comment_id": comment_id}
        ).to_none()

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        """Get a pull request."""
        return self._call(
            "get_pull_request_v1",
            {"pull_request_id": pull_request_id, "request_options": request_options},
        ).to_item(parsers.PullRequest, PullRequest)

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        """Get comments on a pull request."""
        return self._call(
            "get_pull_request_comments_v1",
            {
                "pull_request_id": pull_request_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.Comment, Comment)

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        """Create a comment on a pull request."""
        return self._call(
            "create_pull_request_comment_v1",
            {"pull_request_id": pull_request_id, "body": body},
        ).to_item(parsers.Comment, Comment)

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        """Delete a comment on a pull request."""
        return self._call(
            "delete_pull_request_comment_v1",
            {"pull_request_id": pull_request_id, "comment_id": comment_id},
        ).to_none()

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue comment."""
        return self._call(
            "get_issue_comment_reactions_v1",
            {
                "issue_id": issue_id,
                "comment_id": comment_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.ReactionResult, ReactionResult)

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue comment."""
        return self._call(
            "create_issue_comment_reaction_v1",
            {"issue_id": issue_id, "comment_id": comment_id, "reaction": reaction},
        ).to_item(parsers.ReactionResult, ReactionResult)

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on an issue comment."""
        return self._call(
            "delete_issue_comment_reaction_v1",
            {"issue_id": issue_id, "comment_id": comment_id, "reaction_id": reaction_id},
        ).to_none()

    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on a pull request comment."""
        return self._call(
            "get_pull_request_comment_reactions_v1",
            {
                "pull_request_id": pull_request_id,
                "comment_id": comment_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.ReactionResult, ReactionResult)

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request comment."""
        return self._call(
            "create_pull_request_comment_reaction_v1",
            {"pull_request_id": pull_request_id, "comment_id": comment_id, "reaction": reaction},
        ).to_item(parsers.ReactionResult, ReactionResult)

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        """Delete a reaction on a pull request comment."""
        return self._call(
            "delete_pull_request_comment_reaction_v1",
            {
                "pull_request_id": pull_request_id,
                "comment_id": comment_id,
                "reaction_id": reaction_id,
            },
        ).to_none()

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on an issue."""
        return self._call(
            "get_issue_reactions_v1",
            {"issue_id": issue_id, "pagination": pagination, "request_options": request_options},
        ).to_list(parsers.ReactionResult, ReactionResult)

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on an issue."""
        return self._call(
            "create_issue_reaction_v1", {"issue_id": issue_id, "reaction": reaction}
        ).to_item(parsers.ReactionResult, ReactionResult)

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        """Delete a reaction on an issue."""
        return self._call(
            "delete_issue_reaction_v1", {"issue_id": issue_id, "reaction_id": reaction_id}
        ).to_none()

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        """Get reactions on a pull request."""
        return self._call(
            "get_pull_request_reactions_v1",
            {
                "pull_request_id": pull_request_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.ReactionResult, ReactionResult)

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        """Create a reaction on a pull request."""
        return self._call(
            "create_pull_request_reaction_v1",
            {"pull_request_id": pull_request_id, "reaction": reaction},
        ).to_item(parsers.ReactionResult, ReactionResult)

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        """Delete a reaction on a pull request."""
        return self._call(
            "delete_pull_request_reaction_v1",
            {"pull_request_id": pull_request_id, "reaction_id": reaction_id},
        ).to_none()

    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        """Get a branch reference."""
        return self._call(
            "get_branch_v1", {"branch": branch, "request_options": request_options}
        ).to_item(parsers.GitRef, GitRef)

    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        """Create a new branch pointing at the given SHA."""
        return self._call("create_branch_v1", {"branch": branch, "sha": sha}).to_item(
            parsers.GitRef, GitRef
        )

    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]:
        """Update a branch to point at a new SHA."""
        return self._call(
            "update_branch_v1", {"branch": branch, "sha": sha, "force": force}
        ).to_item(parsers.GitRef, GitRef)

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        """Create a git blob object."""
        return self._call("create_git_blob_v1", {"content": content, "encoding": encoding}).to_item(
            parsers.GitBlob, GitBlob
        )

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        return self._call(
            "get_file_content_v1", {"path": path, "ref": ref, "request_options": request_options}
        ).to_item(parsers.FileContent, FileContent)

    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        return self._call(
            "get_commit_v1", {"sha": sha, "request_options": request_options}
        ).to_item(parsers.Commit, Commit)

    def get_commits(
        self,
        sha: SHA | None = None,
        path: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        return self._call(
            "get_commits_v1",
            {
                "sha": sha,
                "path": path,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.Commit, Commit)

    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        return self._call(
            "compare_commits_v1",
            {
                "start_sha": start_sha,
                "end_sha": end_sha,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.Commit, Commit)

    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        return self._call(
            "get_tree_v1",
            {"tree_sha": tree_sha, "recursive": recursive, "request_options": request_options},
        ).to_item(parsers.GitTree, GitTree)

    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        return self._call(
            "get_git_commit_v1", {"sha": sha, "request_options": request_options}
        ).to_item(parsers.GitCommitObject, GitCommitObject)

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: SHA | None = None,
    ) -> ActionResult[GitTree]:
        return self._call(
            "create_git_tree_v1",
            {"tree": tree, "base_tree": base_tree},
        ).to_item(parsers.GitTree, GitTree)

    def create_git_commit(
        self, message: str, tree_sha: SHA, parent_shas: list[SHA]
    ) -> ActionResult[GitCommitObject]:
        return self._call(
            "create_git_commit_v1",
            {"message": message, "tree_sha": tree_sha, "parent_shas": parent_shas},
        ).to_item(parsers.GitCommitObject, GitCommitObject)

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        return self._call(
            "get_pull_request_files_v1",
            {
                "pull_request_id": pull_request_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.PullRequestFile, PullRequestFile)

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        return self._call(
            "get_pull_request_commits_v1",
            {
                "pull_request_id": pull_request_id,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.PullRequestCommit, PullRequestCommit)

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        return self._call(
            "get_pull_request_diff_v1",
            {"pull_request_id": pull_request_id, "request_options": request_options},
        ).to_string()

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        return self._call(
            "get_pull_requests_v1",
            {
                "state": state,
                "head": head,
                "pagination": pagination,
                "request_options": request_options,
            },
        ).to_list(parsers.PullRequest, PullRequest)

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: BranchName,
        base: BranchName,
        draft: bool = False,
    ) -> ActionResult[PullRequest]:
        return self._call(
            "create_pull_request_v1",
            {"title": title, "body": body, "head": head, "base": base, "draft": draft},
        ).to_item(parsers.PullRequest, PullRequest)

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]:
        return self._call(
            "update_pull_request_v1",
            {"pull_request_id": pull_request_id, "title": title, "body": body, "state": state},
        ).to_item(parsers.PullRequest, PullRequest)

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        return self._call(
            "request_review_v1", {"pull_request_id": pull_request_id, "reviewers": reviewers}
        ).to_none()

    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a file."""
        return self._call(
            "create_review_comment_file_v1",
            {
                "pull_request_id": pull_request_id,
                "commit_id": commit_id,
                "body": body,
                "path": path,
                "side": side,
            },
        ).to_item(parsers.ReviewComment, ReviewComment)

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment in reply to another review comment."""
        return self._call(
            "create_review_comment_reply_v1",
            {
                "pull_request_id": pull_request_id,
                "comment_id": comment_id,
                "body": body,
            },
        ).to_item(parsers.ReviewComment, ReviewComment)

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: SHA,
        event: ReviewEvent,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]:
        return self._call(
            "create_review_v1",
            {
                "pull_request_id": pull_request_id,
                "commit_sha": commit_sha,
                "event": event,
                "comments": comments,
                "body": body,
            },
        ).to_item(parsers.Review, Review)

    def create_check_run(
        self,
        name: str,
        head_sha: SHA,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        return self._call(
            "create_check_run_v1",
            {
                "name": name,
                "head_sha": head_sha,
                "status": status,
                "conclusion": conclusion,
                "external_id": external_id,
                "started_at": started_at,
                "completed_at": completed_at,
                "output": output,
            },
        ).to_item(parsers.CheckRun, CheckRun)

    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        return self._call(
            "get_check_run_v1", {"check_run_id": check_run_id, "request_options": request_options}
        ).to_item(parsers.CheckRun, CheckRun)

    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        return self._call(
            "update_check_run_v1",
            {
                "check_run_id": check_run_id,
                "status": status,
                "conclusion": conclusion,
                "output": output,
            },
        ).to_item(parsers.CheckRun, CheckRun)

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        return self._call(
            "minimize_comment_v1", {"comment_node_id": comment_node_id, "reason": reason}
        ).to_none()
