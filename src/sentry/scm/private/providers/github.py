from collections.abc import Callable
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, cast

import requests

from sentry.integrations.github.client import GitHubApiClient
from sentry.scm.errors import SCMProviderException
from sentry.scm.types import (
    SHA,
    ActionResult,
    ArchiveFormat,
    ArchiveLink,
    Author,
    BranchName,
    BuildConclusion,
    BuildStatus,
    CheckRun,
    CheckRunOutput,
    Comment,
    Commit,
    CommitAuthor,
    CommitFile,
    FileContent,
    FileStatus,
    GitBlob,
    GitCommitObject,
    GitCommitTree,
    GitRef,
    GitTree,
    InputTreeEntry,
    PaginatedActionResult,
    PaginatedResponseMeta,
    PaginationParams,
    PullRequest,
    PullRequestBranch,
    PullRequestCommit,
    PullRequestFile,
    PullRequestState,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    RequestOptions,
    ResourceId,
    ResponseMeta,
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewEvent,
    ReviewSide,
    TreeEntry,
)

# GitHub's Checks API status values map to generic BuildStatus.
# "requested", "waiting", and "pending" are GitHub Actions-internal states that
# cannot be set via the API; we treat them as "pending" when reading.
GITHUB_STATUS_MAP: dict[str, BuildStatus] = {
    "queued": "pending",
    "requested": "pending",
    "waiting": "pending",
    "pending": "pending",
    "in_progress": "running",
    "completed": "completed",
}

# GitHub's conclusion values map 1-to-1 except "stale" (GitHub-internal, set
# automatically after 14 days) which we surface as "unknown".
GITHUB_CONCLUSION_MAP: dict[str, BuildConclusion] = {
    "success": "success",
    "failure": "failure",
    "neutral": "neutral",
    "cancelled": "cancelled",
    "skipped": "skipped",
    "timed_out": "timed_out",
    "action_required": "action_required",
    "stale": "unknown",
}

# Reverse maps for writing to GitHub's Checks API.
# "pending" maps to "queued" (the only writable in-queue state).
# "unknown" has no GitHub equivalent and is omitted; callers should not write it.
GITHUB_STATUS_WRITE_MAP: dict[BuildStatus, str] = {
    "pending": "queued",
    "running": "in_progress",
    "completed": "completed",
}

GITHUB_CONCLUSION_WRITE_MAP: dict[BuildConclusion, str] = {
    "success": "success",
    "failure": "failure",
    "neutral": "neutral",
    "cancelled": "cancelled",
    "skipped": "skipped",
    "timed_out": "timed_out",
    "action_required": "action_required",
    "unknown": "neutral",
}

GITHUB_ARCHIVE_FORMAT_MAP: dict[ArchiveFormat, str] = {
    "tarball": "tarball",
    "zip": "zipball",
}

GITHUB_REVIEW_EVENT_MAP: dict[ReviewEvent, str] = {
    "approve": "APPROVE",
    "change_request": "REQUEST_CHANGES",
    "comment": "COMMENT",
}


MINIMIZE_COMMENT_MUTATION = """
mutation MinimizeComment($commentId: ID!, $reason: ReportedContentClassifiers!) {
    minimizeComment(input: {subjectId: $commentId, classifier: $reason}) {
        minimizedComment { isMinimized }
    }
}
"""


RESERVED_REFERRER_ALLOCATION: dict[Referrer, int] = {"emerge": 500}


def as_github_headers(
    request_options: RequestOptions | None,
) -> dict[str, str]:
    # GitHub recommends this accept header.
    headers = {"Accept": "application/vnd.github+json"}

    # If we were to receive a 304 status response what would we do with it? We haven't thought
    # through how to bubble up the type to the SCM.
    #
    # if request_options:
    #     if_none_match = request_options.get("if_none_match")
    #     if if_none_match is not None:
    #         headers["If-None-Match"] = if_none_match

    #     # If the "if_modified_since" header was provided then we'll only fetch those items which
    #     # were recently modified.
    #     if_modified_since = request_options.get("if_modified_since")
    #     if if_modified_since is not None:
    #         headers["If-Modified-Since"] = if_modified_since.strftime("%Y-%m-%dT%H:%M:%SZ")

    return headers


def as_github_params(params: dict[str, Any], pagination: PaginationParams | None) -> dict[str, str]:
    # Pagination must be set regardless of if it was received or not. The default values are
    # identical to what GitHub sets by default.
    if pagination:
        params["per_page"] = str(pagination["per_page"])
        params["page"] = str(pagination["cursor"])
    else:
        params["per_page"] = "50"
        params["page"] = "1"

    return params


def _extract_response_meta(response: requests.Response) -> ResponseMeta:
    meta: ResponseMeta = {}
    if etag := response.headers.get("ETag"):
        meta["etag"] = etag
    if last_modified := response.headers.get("Last-Modified"):
        meta["last_modified"] = parsedate_to_datetime(last_modified)
    return meta


class GitHubProviderApiClient:
    def __init__(self, client: GitHubApiClient, organization_id: int) -> None:
        self.client = client
        self.organization_id = organization_id

    def _track_rate_limit_headers(self, response: requests.Response) -> None:
        from sentry.scm.private.helpers import update_github_rate_limit_state

        update_github_rate_limit_state(self.organization_id, dict(response.headers))

    def request(
        self,
        method: str,
        path: str,
        data: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        response = self.client._request(
            method=method,
            path=path,
            headers=headers,
            data=data,
            params=params,
            raw_response=True,
        )
        self._track_rate_limit_headers(response)
        return response

    def get(
        self,
        path: str,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        return self.request("GET", path=path, params=params, headers=headers)

    def post(
        self,
        path: str,
        data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        return self.request("POST", path=path, data=data, headers=headers)

    def patch(
        self,
        path: str,
        data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        return self.request("PATCH", path=path, data=data, headers=headers)

    def delete(self, path: str) -> requests.Response:
        return self.request("DELETE", path=path)

    def graphql(
        self,
        query: str,
        variables: dict[str, Any],
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        response = self.post("/graphql", data=payload, headers={})
        if not isinstance(response, dict) or ("data" not in response and "errors" not in response):
            raise SCMProviderException("GraphQL response is not in expected format")

        errors = response.get("errors", [])
        if errors and not response.get("data"):
            err_message = "\n".join(e.get("message", "") for e in errors)
            raise SCMProviderException(err_message)

        return response.get("data", {})


class GitHubProvider:
    def __init__(
        self, client: GitHubApiClient, organization_id: int, repository: Repository
    ) -> None:
        self.client = GitHubProviderApiClient(client, organization_id=organization_id)
        self.organization_id = organization_id
        self.repository = repository

    def is_rate_limited(self, referrer: Referrer) -> bool:
        from sentry.scm.private.helpers import is_rate_limited_with_reserved_quotas

        return is_rate_limited_with_reserved_quotas(
            self.organization_id,
            referrer,
            provider="github",
            reserved_allocations=RESERVED_REFERRER_ALLOCATION,
        )

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/issues/{issue_id}/comments",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_comment(c) for c in r])

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/issues/{issue_id}/comments",
            data={"body": body},
        )
        return map_action(response, map_comment)

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        self.client.delete(f"/repos/{self.repository['name']}/issues/comments/{comment_id}")

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}",
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_pull_request)

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/issues/{pull_request_id}/comments",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_comment(c) for c in r])

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/issues/{pull_request_id}/comments",
            data={"body": body},
        )
        return map_action(response, map_comment)

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        self.client.delete(f"/repos/{self.repository['name']}/issues/comments/{comment_id}")

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/issues/comments/{comment_id}/reactions",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_reaction(c) for c in r])

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/issues/comments/{comment_id}/reactions",
            data={"content": reaction},
        )
        return map_action(response, map_reaction)

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        self.client.delete(
            f"/repos/{self.repository['name']}/issues/comments/{comment_id}/reactions/{reaction_id}"
        )

    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return self.get_issue_comment_reactions(
            pull_request_id, comment_id, pagination, request_options
        )

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return self.create_issue_comment_reaction(pull_request_id, comment_id, reaction)

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        return self.delete_issue_comment_reaction(pull_request_id, comment_id, reaction_id)

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/issues/{issue_id}/reactions",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_reaction(c) for c in r])

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/issues/{issue_id}/reactions",
            data={"content": reaction},
        )
        return map_action(response, map_reaction)

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        self.client.delete(
            f"/repos/{self.repository['name']}/issues/{issue_id}/reactions/{reaction_id}"
        )

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return self.get_issue_reactions(pull_request_id, pagination, request_options)

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return self.create_issue_reaction(pull_request_id, reaction)

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        return self.delete_issue_reaction(pull_request_id, reaction_id)

    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/branches/{branch}",
            headers=as_github_headers(request_options),
        )
        return map_action(response, lambda r: GitRef(ref=r["name"], sha=r["commit"]["sha"]))

    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        ref = f"refs/heads/{branch}"
        response = self.client.post(
            f"/repos/{self.repository['name']}/git/refs",
            data={"ref": ref, "sha": sha},
        )
        return map_action(
            response,
            lambda r: GitRef(ref=r["ref"].removeprefix("refs/heads/"), sha=r["object"]["sha"]),
        )

    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]:
        response = self.client.patch(
            f"/repos/{self.repository['name']}/git/refs/heads/{branch}",
            data={"sha": sha, "force": force},
        )
        return map_action(
            response,
            lambda r: GitRef(ref=r["ref"].removeprefix("refs/heads/"), sha=r["object"]["sha"]),
        )

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/git/blobs",
            data={"content": content, "encoding": encoding},
        )
        return map_action(response, map_git_blob)

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        params: dict[str, str] = {}
        if ref:
            params["ref"] = ref
        response = self.client.get(
            f"/repos/{self.repository['name']}/contents/{path}",
            params=params,
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_file_content)

    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/commits/{sha}",
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_commit)

    def get_commits(
        self,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        params: dict[str, str] = {}
        if ref:
            params["sha"] = ref
        response = self.client.get(
            f"/repos/{self.repository['name']}/commits",
            params=as_github_params(params, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_commit(c) for c in r])

    def get_commits_by_path(
        self,
        path: str,
        ref: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        params: dict[str, str] = {"path": path}
        if ref:
            params["sha"] = ref
        response = self.client.get(
            f"/repos/{self.repository['name']}/commits",
            params=as_github_params(params, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(pagination, response, lambda r: [map_commit(c) for c in r])

    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/compare/{start_sha}...{end_sha}",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(
            pagination, response, lambda r: [map_commit(c) for c in r["commits"]]
        )

    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        params: dict[str, Any] = {}
        if recursive:
            params["recursive"] = 1
        response = self.client.get(
            f"/repos/{self.repository['name']}/git/trees/{tree_sha}",
            params=params,
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_git_tree)

    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/git/commits/{sha}",
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_git_commit_object)

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: SHA | None = None,
    ) -> ActionResult[GitTree]:
        data: dict[str, Any] = {"tree": tree}
        if base_tree is not None:
            data["base_tree"] = base_tree
        response = self.client.post(
            f"/repos/{self.repository['name']}/git/trees",
            data=data,
        )
        return map_action(response, map_git_tree)

    def create_git_commit(
        self,
        message: str,
        tree_sha: SHA,
        parent_shas: list[SHA],
    ) -> ActionResult[GitCommitObject]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/git/commits",
            data={
                "message": message,
                "tree": tree_sha,
                "parents": parent_shas,
            },
        )
        return map_action(response, map_git_commit_object)

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/files",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(
            pagination, response, lambda r: [map_pull_request_file(f) for f in r]
        )

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/commits",
            params=as_github_params({}, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(
            pagination, response, lambda r: [map_pull_request_commit(c) for c in r]
        )

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        headers = as_github_headers(request_options)
        headers["Accept"] = "application/vnd.github.v3.diff"

        response = self.client.request(
            "GET",
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}",
            headers=headers,
        )
        return {
            "data": response.text,
            "type": "github",
            "raw": response.text,
            "meta": _extract_response_meta(response),
        }

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        params: dict[str, Any] = {"state": state if state is not None else "all"}
        if head:
            params["head"] = head

        response = self.client.get(
            f"/repos/{self.repository['name']}/pulls",
            params=as_github_params(params, pagination),
            headers=as_github_headers(request_options),
        )
        return map_paginated_action(
            pagination, response, lambda r: [map_pull_request(pr) for pr in r]
        )

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
    ) -> ActionResult[PullRequest]:
        data: dict[str, Any] = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
        }
        response = self.client.post(f"/repos/{self.repository['name']}/pulls", data=data)
        return map_action(response, map_pull_request)

    def create_pull_request_draft(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
    ) -> ActionResult[PullRequest]:
        response = self.client.post(
            f"/repos/{self.repository['name']}/pulls",
            data={"title": title, "body": body, "head": head, "base": base, "draft": True},
        )
        return map_action(response, map_pull_request)

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: PullRequestState | None = None,
    ) -> ActionResult[PullRequest]:
        data: dict[str, Any] = {}
        if title is not None:
            data["title"] = title
        if body is not None:
            data["body"] = body
        if state is not None:
            data["state"] = state
        response = self.client.patch(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}", data=data
        )
        return map_action(response, map_pull_request)

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        self.client.post(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/requested_reviewers",
            data={"reviewers": reviewers},
        )

    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a file."""
        response = self.client.post(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/comments",
            data={
                "body": body,
                "commit_id": commit_id,
                "path": path,
                "side": side,
                "subject_type": "file",
            },
        )
        return map_action(response, map_review_comment)

    # create_review_comment_line: not supported
    # create_review_comment_multiline: not supported

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment in reply to another review comment."""
        response = self.client.post(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/comments",
            data={
                "body": body,
                "in_reply_to": int(comment_id),
            },
        )
        return map_action(response, map_review_comment)

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: SHA,
        event: ReviewEvent,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]:
        data: dict[str, Any] = {
            "commit_id": commit_sha,
            "event": GITHUB_REVIEW_EVENT_MAP[event],
            "comments": comments,
        }
        if body is not None:
            data["body"] = body
        response = self.client.post(
            f"/repos/{self.repository['name']}/pulls/{pull_request_id}/reviews",
            data=data,
        )
        return map_action(response, map_review)

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
        data: dict[str, Any] = {
            "name": name,
            "head_sha": head_sha,
        }
        if status is not None:
            data["status"] = GITHUB_STATUS_WRITE_MAP[status]
        if conclusion is not None:
            data["conclusion"] = GITHUB_CONCLUSION_WRITE_MAP[conclusion]
        if external_id is not None:
            data["external_id"] = external_id
        if started_at is not None:
            data["started_at"] = started_at
        if completed_at is not None:
            data["completed_at"] = completed_at
        if output is not None:
            data["output"] = output
        response = self.client.post(
            f"/repos/{self.repository['name']}/check-runs",
            data=data,
        )
        return map_action(response, map_check_run)

    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/check-runs/{check_run_id}",
            headers=as_github_headers(request_options),
        )
        return map_action(response, map_check_run)

    def update_check_run(
        self,
        check_run_id: ResourceId,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        data: dict[str, Any] = {}
        if status is not None:
            data["status"] = GITHUB_STATUS_WRITE_MAP[status]
        if conclusion is not None:
            data["conclusion"] = GITHUB_CONCLUSION_WRITE_MAP[conclusion]
        if output is not None:
            data["output"] = output
        response = self.client.patch(
            f"/repos/{self.repository['name']}/check-runs/{check_run_id}",
            data=data,
        )
        return map_action(response, map_check_run)

    def get_archive_link(
        self,
        ref: str,
        archive_format: ArchiveFormat = "tarball",
        request_options: RequestOptions | None = None,
    ) -> ActionResult[ArchiveLink]:
        response = self.client.get(
            f"/repos/{self.repository['name']}/{GITHUB_ARCHIVE_FORMAT_MAP[archive_format]}/{ref}",
            headers=as_github_headers(request_options),
        )
        return {
            "data": ArchiveLink(url=response.url, headers={}),
            "type": "github",
            "raw": response.url,
            "meta": _extract_response_meta(response),
        }

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        self.client.graphql(
            MINIMIZE_COMMENT_MUTATION,
            {"commentId": comment_node_id, "reason": reason},
        )

    # resolve_review_thread: not supported


def map_author(raw_user: dict[str, Any] | None) -> Author | None:
    if raw_user is None:
        return None
    return Author(id=str(raw_user["id"]), username=raw_user["login"])


def map_comment(raw: dict[str, Any]) -> Comment:
    return Comment(
        id=str(raw["id"]),
        body=raw["body"],
        author=map_author(raw.get("user")),
    )


def map_reaction(raw: dict[str, Any]) -> ReactionResult:
    return ReactionResult(
        id=str(raw["id"]),
        content=raw["content"],
        author=map_author(raw.get("user")),
    )


def map_git_blob(raw: dict[str, Any]) -> GitBlob:
    return GitBlob(sha=raw["sha"])


def map_file_content(raw: dict[str, Any]) -> FileContent:
    return FileContent(
        path=raw["path"],
        sha=raw["sha"],
        content=raw.get("content", ""),
        encoding=raw.get("encoding", ""),
        size=raw["size"],
    )


def map_commit_author(raw_author: dict[str, Any] | None) -> CommitAuthor | None:
    if raw_author is None:
        return None

    raw_date = raw_author.get("date")
    date = datetime.fromisoformat(raw_date) if raw_date else None

    return CommitAuthor(
        name=raw_author.get("name", ""),
        email=raw_author.get("email", ""),
        date=date,
    )


_VALID_FILE_STATUSES: set[str] = {
    "added",
    "removed",
    "modified",
    "renamed",
    "copied",
    "changed",
    "unchanged",
}


def map_commit_file(raw_file: dict[str, Any]) -> CommitFile:
    raw_status = raw_file.get("status", "modified")
    status = raw_status if raw_status in _VALID_FILE_STATUSES else "unknown"
    return CommitFile(
        filename=raw_file["filename"],
        status=cast(FileStatus, status),
        patch=raw_file.get("patch"),
    )


def map_commit(raw: dict[str, Any]) -> Commit:
    commit = raw.get("commit", {})
    return Commit(
        id=raw["sha"],
        message=commit.get("message", ""),
        author=map_commit_author(commit.get("author")),
        files=[map_commit_file(f) for f in raw.get("files", [])],
    )


def map_tree_entry(raw_entry: dict[str, Any]) -> TreeEntry:
    return TreeEntry(
        path=raw_entry["path"],
        mode=raw_entry["mode"],
        type=raw_entry["type"],
        sha=raw_entry["sha"],
        size=raw_entry.get("size"),
    )


def map_git_tree(raw: dict[str, Any]) -> GitTree:
    """Transform a full git tree API response (from create_git_tree)."""
    return GitTree(
        sha=raw["sha"],
        tree=[map_tree_entry(e) for e in raw["tree"]],
        truncated=raw["truncated"],
    )


def map_git_commit_object(raw: dict[str, Any]) -> GitCommitObject:
    return GitCommitObject(
        sha=raw["sha"],
        tree=GitCommitTree(sha=raw["tree"]["sha"]),
        message=raw.get("message", ""),
    )


def map_review_comment(raw: dict[str, Any]) -> ReviewComment:
    return ReviewComment(
        id=str(raw["id"]),
        html_url=raw["html_url"],
        path=raw["path"],
        body=raw["body"],
    )


def map_review(raw: dict[str, Any]) -> Review:
    return Review(
        id=str(raw["id"]),
        html_url=raw["html_url"],
    )


def map_check_run(raw: dict[str, Any]) -> CheckRun:
    raw_status = raw.get("status", "")
    raw_conclusion = raw.get("conclusion")
    return CheckRun(
        id=str(raw["id"]),
        name=raw.get("name", ""),
        status=GITHUB_STATUS_MAP.get(raw_status, "pending"),
        conclusion=GITHUB_CONCLUSION_MAP.get(raw_conclusion) if raw_conclusion else None,
        html_url=raw.get("html_url", ""),
    )


def map_pull_request_file(raw_file: dict[str, Any]) -> PullRequestFile:
    raw_status = raw_file.get("status", "modified")
    status = raw_status if raw_status in _VALID_FILE_STATUSES else "unknown"
    return PullRequestFile(
        filename=raw_file["filename"],
        status=cast(FileStatus, status),
        patch=raw_file.get("patch"),
        changes=raw_file.get("changes", 0),
        sha=raw_file.get("sha", ""),
        previous_filename=raw_file.get("previous_filename"),
    )


def map_pull_request_commit(raw: dict[str, Any]) -> PullRequestCommit:
    raw_author = raw.get("commit", {}).get("author")
    return PullRequestCommit(
        sha=raw["sha"],
        message=raw.get("commit", {}).get("message", ""),
        author=map_commit_author(raw_author),
    )


def map_pull_request(raw: dict[str, Any]) -> PullRequest:
    return PullRequest(
        id=str(raw["id"]),
        number=str(raw["number"]),
        title=raw["title"],
        body=raw.get("body"),
        state=raw["state"],
        merged=raw.get("merged_at") is not None,
        html_url=raw.get("html_url", ""),
        head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
        base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
    )


def map_action[T](
    response: requests.Response, fn: Callable[[dict[str, Any]], T]
) -> ActionResult[T]:
    raw = response.json()
    return {
        "data": fn(raw),
        "type": "github",
        "raw": raw,
        "meta": _extract_response_meta(response),
    }


def map_paginated_action[T](
    pagination: PaginationParams | None,
    response: requests.Response,
    fn: Callable[[Any], list[T]],
) -> PaginatedActionResult[T]:
    raw = response.json()
    meta: PaginatedResponseMeta = {
        **_extract_response_meta(response),
        "next_cursor": str(int(pagination["cursor"]) + 1 if pagination else 2),
    }
    return {
        "data": fn(raw),
        "type": "github",
        "raw": raw,
        "meta": meta,
    }
