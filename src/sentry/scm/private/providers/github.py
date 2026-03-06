import functools
from collections.abc import Callable
from datetime import datetime
from typing import Any, cast

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.errors import SCMProviderException
from sentry.scm.types import (
    SHA,
    ActionResult,
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
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewEvent,
    ReviewSide,
    TreeEntry,
)
from sentry.shared_integrations.exceptions import ApiError

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

REACTION_MAP = {
    "+1": GitHubReaction.PLUS_ONE,
    "-1": GitHubReaction.MINUS_ONE,
    "laugh": GitHubReaction.LAUGH,
    "confused": GitHubReaction.CONFUSED,
    "heart": GitHubReaction.HEART,
    "hooray": GitHubReaction.HOORAY,
    "rocket": GitHubReaction.ROCKET,
    "eyes": GitHubReaction.EYES,
}

GITHUB_REVIEW_EVENT_MAP: dict[ReviewEvent, str] = {
    "approve": "APPROVE",
    "change_request": "REQUEST_CHANGES",
    "comment": "COMMENT",
}


# TODO: Rate-limits are dynamic per org. Some will have higher limits. We need to dynamically
#       configure the shared pool. The absolute allocation amount for explicit referrers can
#       remain unchanged.
REFERRER_ALLOCATION: dict[Referrer, int] = {"shared": 4500, "emerge": 500}

# Placeholder pagination meta until the GitHub client supports pagination.
_DEFAULT_PAGINATED_META: PaginatedResponseMeta = PaginatedResponseMeta(next_cursor=None)


def catch_provider_exception(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    return wrapper


class GitHubProvider:
    def __init__(self, client: GitHubApiClient, repository: Repository) -> None:
        self.client = client
        self.repository = repository

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        # from sentry.scm.helpers import is_rate_limited_with_allocation_policy

        # return is_rate_limited_with_allocation_policy(
        #     organization_id,
        #     referrer,
        #     provider="github",
        #     window=3600,
        #     allocation_policy=REFERRER_ALLOCATION,
        # )
        return False  # Rate-limits temporarily disabled.

    @catch_provider_exception
    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        raw_comments = self.client.get_issue_comments(self.repository["name"], issue_id)
        return PaginatedActionResult(
            data=[map_comment(c) for c in raw_comments],
            type="github",
            raw=raw_comments,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        raw = self.client.create_comment(self.repository["name"], issue_id, {"body": body})
        return map_action(raw, map_comment)

    @catch_provider_exception
    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        self.client.delete_issue_comment(self.repository["name"], comment_id)

    @catch_provider_exception
    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        raw = self.client.get_pull_request(self.repository["name"], pull_request_id)
        return map_action(raw, map_pull_request)

    @catch_provider_exception
    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        comments = self.client.get_issue_comments(self.repository["name"], pull_request_id)
        return PaginatedActionResult(
            data=[map_comment(c) for c in comments],
            type="github",
            raw=comments,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        raw = self.client.create_comment(self.repository["name"], pull_request_id, {"body": body})
        return map_action(raw, map_comment)

    @catch_provider_exception
    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        self.client.delete_issue_comment(self.repository["name"], comment_id)

    @catch_provider_exception
    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw_reactions = self.client.get_comment_reactions(self.repository["name"], comment_id)
        return PaginatedActionResult(
            data=[map_reaction(r) for r in raw_reactions],
            type="github",
            raw=raw_reactions,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        github_reaction = REACTION_MAP[reaction]
        raw = self.client.create_comment_reaction(
            self.repository["name"], comment_id, github_reaction
        )
        return map_action(raw, map_reaction)

    @catch_provider_exception
    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        self.client.delete_comment_reaction(self.repository["name"], comment_id, reaction_id)

    @catch_provider_exception
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

    @catch_provider_exception
    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return self.create_issue_comment_reaction(pull_request_id, comment_id, reaction)

    @catch_provider_exception
    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        return self.delete_issue_comment_reaction(pull_request_id, comment_id, reaction_id)

    @catch_provider_exception
    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        raw_reactions = self.client.get_issue_reactions(self.repository["name"], issue_id)
        return PaginatedActionResult(
            data=[map_reaction(r) for r in raw_reactions],
            type="github",
            raw=raw_reactions,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        github_reaction = REACTION_MAP[reaction]
        raw = self.client.create_issue_reaction(self.repository["name"], issue_id, github_reaction)
        return map_action(raw, map_reaction)

    @catch_provider_exception
    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        self.client.delete_issue_reaction(self.repository["name"], issue_id, reaction_id)

    @catch_provider_exception
    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return self.get_issue_reactions(pull_request_id, pagination, request_options)

    @catch_provider_exception
    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return self.create_issue_reaction(pull_request_id, reaction)

    @catch_provider_exception
    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        return self.delete_issue_reaction(pull_request_id, reaction_id)

    @catch_provider_exception
    def get_branch(
        self,
        branch: BranchName,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        raw = self.client.get_branch(self.repository["name"], branch)
        return map_action(raw, lambda r: GitRef(ref=r["name"], sha=r["commit"]["sha"]))

    @catch_provider_exception
    def create_branch(self, branch: BranchName, sha: SHA) -> ActionResult[GitRef]:
        ref = f"refs/heads/{branch}"
        raw = self.client.create_git_ref(self.repository["name"], {"ref": ref, "sha": sha})
        return map_action(
            raw, lambda r: GitRef(ref=r["ref"].removeprefix("refs/heads/"), sha=r["object"]["sha"])
        )

    @catch_provider_exception
    def update_branch(
        self, branch: BranchName, sha: SHA, force: bool = False
    ) -> ActionResult[GitRef]:
        raw = self.client.update_git_ref(
            self.repository["name"], branch, {"sha": sha, "force": force}
        )
        return map_action(
            raw, lambda r: GitRef(ref=r["ref"].removeprefix("refs/heads/"), sha=r["object"]["sha"])
        )

    @catch_provider_exception
    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        data: dict[str, Any] = {"content": content, "encoding": encoding}
        raw = self.client.create_git_blob(self.repository["name"], data)
        return map_action(raw, map_git_blob)

    @catch_provider_exception
    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        raw = self.client.get_file_content(self.repository["name"], path, ref)
        return map_action(raw, map_file_content)

    @catch_provider_exception
    def get_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        raw = self.client.get_commit(self.repository["name"], sha)
        return map_action(raw, map_commit)

    @catch_provider_exception
    def get_commits(
        self,
        sha: SHA | None = None,
        path: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        raw_commits = self.client.get_commits(self.repository["name"], sha=sha, path=path)
        return PaginatedActionResult(
            data=[map_commit(c) for c in raw_commits],
            type="github",
            raw=raw_commits,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def compare_commits(
        self,
        start_sha: SHA,
        end_sha: SHA,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        raw_commits = self.client.compare_commits(self.repository["name"], start_sha, end_sha)
        return PaginatedActionResult(
            data=[map_commit(c) for c in raw_commits],
            type="github",
            raw=raw_commits,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def get_tree(
        self,
        tree_sha: SHA,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        raw = self.client.get_tree_full(self.repository["name"], tree_sha, recursive=recursive)
        return map_action(raw, map_git_tree)

    @catch_provider_exception
    def get_git_commit(
        self,
        sha: SHA,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        raw = self.client.get_git_commit(self.repository["name"], sha)
        return map_action(raw, map_git_commit_object)

    @catch_provider_exception
    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: SHA | None = None,
    ) -> ActionResult[GitTree]:
        data: dict[str, Any] = {"tree": tree}
        if base_tree is not None:
            data["base_tree"] = base_tree
        raw = self.client.create_git_tree(self.repository["name"], data)
        return map_action(raw, map_git_tree)

    @catch_provider_exception
    def create_git_commit(
        self,
        message: str,
        tree_sha: SHA,
        parent_shas: list[SHA],
    ) -> ActionResult[GitCommitObject]:
        data: dict[str, Any] = {
            "message": message,
            "tree": tree_sha,
            "parents": parent_shas,
        }
        raw = self.client.create_git_commit(self.repository["name"], data)
        return map_action(raw, map_git_commit_object)

    @catch_provider_exception
    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        raw_files = self.client.get_pull_request_files(self.repository["name"], pull_request_id)
        return PaginatedActionResult(
            data=[map_pull_request_file(f) for f in raw_files],
            type="github",
            raw=raw_files,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        raw_commits = self.client.get_pull_request_commits(self.repository["name"], pull_request_id)
        return PaginatedActionResult(
            data=[map_pull_request_commit(c) for c in raw_commits],
            type="github",
            raw=raw_commits,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        resp = self.client.get_pull_request_diff(self.repository["name"], pull_request_id)
        return ActionResult(
            data=resp.text,
            type="github",
            raw=resp.text,
            meta={},
        )

    @catch_provider_exception
    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: BranchName | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        github_state = state if state is not None else "all"
        raw_prs = self.client.list_pull_requests(self.repository["name"], github_state, head)
        return PaginatedActionResult(
            data=[map_pull_request(pr) for pr in raw_prs],
            type="github",
            raw=raw_prs,
            meta=_DEFAULT_PAGINATED_META,
        )

    @catch_provider_exception
    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
        draft: bool = False,
    ) -> ActionResult[PullRequest]:
        data: dict[str, Any] = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "draft": draft,
        }
        raw = self.client.create_pull_request(self.repository["name"], data)
        return map_action(raw, map_pull_request)

    @catch_provider_exception
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
        raw = self.client.update_pull_request(self.repository["name"], pull_request_id, data)
        return map_action(raw, map_pull_request)

    @catch_provider_exception
    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        self.client.create_review_request(
            self.repository["name"], pull_request_id, {"reviewers": reviewers}
        )

    @catch_provider_exception
    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a file."""
        return map_action(
            self.client.create_review_comment(
                self.repository["name"],
                pull_request_id,
                {
                    "body": body,
                    "commit_id": commit_id,
                    "path": path,
                    "side": side,
                    "subject_type": "file",
                },
            ),
            map_review_comment,
        )

    @catch_provider_exception
    def create_review_comment_line(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        line: int,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a specific line in a file."""
        return map_action(
            self.client.create_review_comment(
                self.repository["name"],
                pull_request_id,
                {
                    "body": body,
                    "commit_id": commit_id,
                    "path": path,
                    "line": line,
                    "side": side,
                    "subject_type": "line",
                },
            ),
            map_review_comment,
        )

    @catch_provider_exception
    def create_review_comment_multiline(
        self,
        pull_request_id: str,
        commit_id: SHA,
        body: str,
        path: str,
        start_line: int,
        start_side: ReviewSide,
        end_line: int,
        end_side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment on a multiline span in a file."""
        return map_action(
            self.client.create_review_comment(
                self.repository["name"],
                pull_request_id,
                {
                    "body": body,
                    "commit_id": commit_id,
                    "path": path,
                    "line": end_line,
                    "side": end_side,
                    "start_line": start_line,
                    "start_side": start_side,
                    "subject_type": "line",
                },
            ),
            map_review_comment,
        )

    @catch_provider_exception
    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        """Leave a review comment in reply to another review comment."""
        return map_action(
            self.client.create_review_comment(
                self.repository["name"],
                pull_request_id,
                {
                    "body": body,
                    "in_reply_to": int(comment_id),
                },
            ),
            map_review_comment,
        )

    @catch_provider_exception
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
        raw = self.client.create_review(self.repository["name"], pull_request_id, data)
        return map_action(raw, map_review)

    @catch_provider_exception
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
        raw = self.client.create_check_run(self.repository["name"], data)
        return map_action(raw, map_check_run)

    @catch_provider_exception
    def get_check_run(
        self,
        check_run_id: ResourceId,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        raw = self.client.get_check_run(self.repository["name"], int(check_run_id))
        return map_action(raw, map_check_run)

    @catch_provider_exception
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
        raw = self.client.update_check_run(self.repository["name"], check_run_id, data)
        return map_action(raw, map_check_run)

    @catch_provider_exception
    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        self.client.minimize_comment(comment_node_id, reason)

    @catch_provider_exception
    def resolve_review_thread(self, thread_node_id: str) -> None:
        self.client.resolve_review_thread(thread_node_id)


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
        number=raw["number"],
        title=raw["title"],
        body=raw.get("body"),
        state=raw["state"],
        merged=raw.get("merged", False),
        url=raw.get("url", ""),
        html_url=raw.get("html_url", ""),
        head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
        base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
    )


def map_action[T](raw: dict[str, Any], fn: Callable[[dict[str, Any]], T]) -> ActionResult[T]:
    return {
        "data": fn(raw),
        "type": "github",
        "raw": raw,
        "meta": {},
    }
