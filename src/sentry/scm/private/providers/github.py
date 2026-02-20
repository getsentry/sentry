from typing import Any

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.errors import SCMProviderException
from sentry.scm.types import (
    ActionResult,
    Author,
    CheckRun,
    CheckRunConclusion,
    CheckRunOutput,
    CheckRunStatus,
    Comment,
    Commit,
    CommitAuthor,
    CommitComparison,
    CommitFile,
    FileContent,
    GitBlob,
    GitCommitObject,
    GitCommitTree,
    GitRef,
    GitTree,
    InputTreeEntry,
    PullRequest,
    PullRequestBranch,
    PullRequestCommit,
    PullRequestFile,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewSide,
    TreeEntry,
)
from sentry.shared_integrations.exceptions import ApiError

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


# TODO: Rate-limits are dynamic per org. Some will have higher limits. We need to dynamically
#       configure the shared pool. The absolute allocation amount for explicit referrers can
#       remain unchanged.
REFERRER_ALLOCATION: dict[Referrer, int] = {"shared": 4500, "emerge": 500}


def _transform_author(raw_user: dict[str, Any] | None) -> Author | None:
    if raw_user is None:
        return None
    return Author(id=str(raw_user["id"]), username=raw_user["login"])


def _transform_comment(raw: dict[str, Any]) -> ActionResult[Comment]:
    return ActionResult(
        data=Comment(
            id=str(raw["id"]),
            body=raw["body"],
            author=_transform_author(raw.get("user")),
        ),
        type="github",
        raw=raw,
    )


def _transform_reaction(raw: dict[str, Any]) -> ActionResult[ReactionResult]:
    return ActionResult(
        data=ReactionResult(
            id=str(raw["id"]),
            content=raw["content"],
            author=_transform_author(raw.get("user")),
        ),
        type="github",
        raw=raw,
    )


def _transform_git_ref(raw: dict[str, Any]) -> ActionResult[GitRef]:
    obj = raw.get("object", raw)
    ref_str = raw.get("ref", "")
    return ActionResult(
        data=GitRef(
            ref=ref_str,
            sha=obj.get("sha", raw.get("commit", {}).get("sha", "")),
        ),
        type="github",
        raw=raw,
    )


def _transform_git_blob(raw: dict[str, Any]) -> ActionResult[GitBlob]:
    return ActionResult(
        data=GitBlob(sha=raw["sha"]),
        type="github",
        raw=raw,
    )


def _transform_file_content(raw: dict[str, Any]) -> ActionResult[FileContent]:
    return ActionResult(
        data=FileContent(
            path=raw["path"],
            sha=raw["sha"],
            content=raw.get("content", ""),
            encoding=raw.get("encoding", ""),
            size=raw["size"],
        ),
        type="github",
        raw=raw,
    )


def _transform_commit_author(raw_author: dict[str, Any] | None) -> CommitAuthor | None:
    if raw_author is None:
        return None
    return CommitAuthor(
        name=raw_author.get("name", ""),
        email=raw_author.get("email", ""),
        date=raw_author.get("date", ""),
    )


def _transform_commit_file(raw_file: dict[str, Any]) -> CommitFile:
    return CommitFile(
        filename=raw_file["filename"],
        status=raw_file.get("status", ""),
        patch=raw_file.get("patch"),
    )


def _transform_commit(raw: dict[str, Any]) -> ActionResult[Commit]:
    commit_data = raw.get("commit", {})
    return ActionResult(
        data=Commit(
            sha=raw["sha"],
            message=commit_data.get("message", ""),
            author=_transform_commit_author(commit_data.get("author")),
            files=[_transform_commit_file(f) for f in raw.get("files", [])],
        ),
        type="github",
        raw=raw,
    )


def _transform_commit_comparison(raw: dict[str, Any]) -> ActionResult[CommitComparison]:
    return ActionResult(
        data=CommitComparison(
            ahead_by=raw.get("ahead_by", 0),
            behind_by=raw.get("behind_by", 0),
        ),
        type="github",
        raw=raw,
    )


def _transform_tree_entry(raw_entry: dict[str, Any]) -> TreeEntry:
    return TreeEntry(
        path=raw_entry["path"],
        mode=raw_entry.get("mode", ""),
        type=raw_entry["type"],
        sha=raw_entry["sha"],
        size=raw_entry.get("size"),
    )


def _transform_git_tree_from_list(raw_entries: list[dict[str, Any]]) -> ActionResult[GitTree]:
    """Transform the list returned by client.get_tree() (truncated flag unavailable)."""
    return ActionResult(
        data=GitTree(
            tree=[_transform_tree_entry(e) for e in raw_entries],
            truncated=False,
        ),
        type="github",
        raw={"tree": raw_entries},
    )


def _transform_git_tree(raw: dict[str, Any]) -> ActionResult[GitTree]:
    """Transform a full git tree API response (from create_git_tree)."""
    return ActionResult(
        data=GitTree(
            tree=[_transform_tree_entry(e) for e in raw.get("tree", [])],
            truncated=raw.get("truncated", False),
        ),
        type="github",
        raw=raw,
    )


def _transform_git_commit_object(raw: dict[str, Any]) -> ActionResult[GitCommitObject]:
    return ActionResult(
        data=GitCommitObject(
            sha=raw["sha"],
            tree=GitCommitTree(sha=raw["tree"]["sha"]),
            message=raw.get("message", ""),
        ),
        type="github",
        raw=raw,
    )


def _transform_review_comment(raw: dict[str, Any]) -> ActionResult[ReviewComment]:
    return ActionResult(
        data=ReviewComment(
            id=raw["id"],
            html_url=raw.get("html_url", ""),
            path=raw.get("path", ""),
            body=raw.get("body", ""),
        ),
        type="github",
        raw=raw,
    )


def _transform_review(raw: dict[str, Any]) -> ActionResult[Review]:
    return ActionResult(
        data=Review(
            id=raw["id"],
            html_url=raw.get("html_url", ""),
        ),
        type="github",
        raw=raw,
    )


def _transform_check_run(raw: dict[str, Any]) -> ActionResult[CheckRun]:
    return ActionResult(
        data=CheckRun(
            id=raw["id"],
            name=raw.get("name", ""),
            status=raw.get("status", ""),
            conclusion=raw.get("conclusion"),
            html_url=raw.get("html_url", ""),
        ),
        type="github",
        raw=raw,
    )


def _transform_graphql_author(raw_author: dict[str, Any] | None) -> Author | None:
    if raw_author is None:
        return None
    return Author(id=raw_author.get("login", ""), username=raw_author.get("login", ""))


def _transform_graphql_comment(
    raw: dict[str, Any], comment_type: str = "issue_comment"
) -> ActionResult[Comment]:
    enriched_raw = {**raw, "comment_type": comment_type}
    return ActionResult(
        data=Comment(
            id=raw["id"],
            body=raw.get("body", ""),
            author=_transform_graphql_author(raw.get("author")),
        ),
        type="github",
        raw=enriched_raw,
    )


def _transform_graphql_pr_comments(raw: dict[str, Any]) -> list[ActionResult[Comment]]:
    """Flatten GraphQL issue comments and review thread comments into a single list.

    Review thread comments have their ``raw`` dict enriched with thread-level
    metadata (``thread_id``, ``isResolved``, ``isOutdated``, ``isCollapsed``)
    so callers can access it without a separate query.
    """
    pr_data = raw.get("repository", {}).get("pullRequest", {})
    results: list[ActionResult[Comment]] = []

    for node in pr_data.get("comments", {}).get("nodes", []):
        results.append(_transform_graphql_comment(node, comment_type="issue_comment"))

    for thread in pr_data.get("reviewThreads", {}).get("nodes", []):
        thread_meta = {
            "thread_id": thread.get("id"),
            "isResolved": thread.get("isResolved", False),
            "isOutdated": thread.get("isOutdated", False),
            "isCollapsed": thread.get("isCollapsed", False),
        }
        for node in thread.get("comments", {}).get("nodes", []):
            result = _transform_graphql_comment(node, comment_type="pull_request_review_comment")
            result["raw"].update(thread_meta)
            results.append(result)

    return results


def _transform_pull_request_file(raw_file: dict[str, Any]) -> PullRequestFile:
    return PullRequestFile(
        filename=raw_file["filename"],
        status=raw_file.get("status", ""),
        patch=raw_file.get("patch"),
        changes=raw_file.get("changes", 0),
        sha=raw_file.get("sha", ""),
        previous_filename=raw_file.get("previous_filename"),
    )


def _transform_pull_request_commit(raw: dict[str, Any]) -> PullRequestCommit:
    raw_author = raw.get("commit", {}).get("author")
    return PullRequestCommit(
        sha=raw["sha"],
        message=raw.get("commit", {}).get("message", ""),
        author=_transform_commit_author(raw_author),
    )


def _transform_pull_request(raw: dict[str, Any]) -> ActionResult[PullRequest]:
    return ActionResult(
        data=PullRequest(
            id=raw["id"],
            number=raw["number"],
            title=raw["title"],
            body=raw.get("body"),
            state=raw["state"],
            merged=raw.get("merged", False),
            url=raw.get("url", ""),
            html_url=raw.get("html_url", ""),
            head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
            base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
        ),
        type="github",
        raw=raw,
    )


class GitHubProvider:
    def __init__(self, client: GitHubApiClient, repository: Repository) -> None:
        self.client = client
        self.repository = repository

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        from sentry.scm.helpers import is_rate_limited_with_allocation_policy

        return is_rate_limited_with_allocation_policy(
            organization_id,
            referrer,
            provider="github",
            window=3600,
            allocation_policy=REFERRER_ALLOCATION,
        )

    def get_issue_comments(self, issue_id: str) -> list[ActionResult[Comment]]:
        try:
            raw_comments = self.client.get_issue_comments(self.repository["name"], issue_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_comment(c) for c in raw_comments]

    def create_issue_comment(self, issue_id: str, body: str) -> None:
        try:
            self.client.create_comment(self.repository["name"], issue_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_comment(self, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(self.repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request(self, pull_request_id: str) -> ActionResult[PullRequest]:
        try:
            raw = self.client.get_pull_request(self.repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def get_pull_request_comments(self, pull_request_id: str) -> list[ActionResult[Comment]]:
        owner, repo = self.repository["name"].split("/", 1)
        try:
            raw = self.client.get_pull_request_comments_graphql(
                owner,
                repo,
                int(pull_request_id),
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_graphql_pr_comments(raw)

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> None:
        try:
            self.client.create_comment(self.repository["name"], pull_request_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_pull_request_comment(self, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(self.repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_issue_comment_reactions(self, comment_id: str) -> list[ActionResult[ReactionResult]]:
        try:
            raw_reactions = self.client.get_comment_reactions(self.repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_reaction(r) for r in raw_reactions]

    def create_issue_comment_reaction(self, comment_id: str, reaction: Reaction) -> None:
        github_reaction = REACTION_MAP[reaction]
        try:
            self.client.create_comment_reaction(
                self.repository["name"], comment_id, github_reaction
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_comment_reaction(self, comment_id: str, reaction_id: str) -> None:
        try:
            self.client.delete_comment_reaction(self.repository["name"], comment_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request_comment_reactions(
        self, comment_id: str
    ) -> list[ActionResult[ReactionResult]]:
        return self.get_issue_comment_reactions(comment_id)

    def create_pull_request_comment_reaction(self, comment_id: str, reaction: Reaction) -> None:
        return self.create_issue_comment_reaction(comment_id, reaction)

    def delete_pull_request_comment_reaction(self, comment_id: str, reaction_id: str) -> None:
        return self.delete_issue_comment_reaction(comment_id, reaction_id)

    def get_issue_reactions(self, issue_id: str) -> list[ActionResult[ReactionResult]]:
        try:
            raw_reactions = self.client.get_issue_reactions(self.repository["name"], issue_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_reaction(r) for r in raw_reactions]

    def create_issue_reaction(self, issue_id: str, reaction: Reaction) -> None:
        github_reaction = REACTION_MAP[reaction]
        try:
            self.client.create_issue_reaction(self.repository["name"], issue_id, github_reaction)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        try:
            self.client.delete_issue_reaction(self.repository["name"], issue_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request_reactions(
        self, pull_request_id: str
    ) -> list[ActionResult[ReactionResult]]:
        return self.get_issue_reactions(pull_request_id)

    def create_pull_request_reaction(self, pull_request_id: str, reaction: Reaction) -> None:
        return self.create_issue_reaction(pull_request_id, reaction)

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        return self.delete_issue_reaction(pull_request_id, reaction_id)

    # Branch operations

    def get_branch(self, branch: str) -> ActionResult[GitRef]:
        try:
            raw = self.client.get_branch(self.repository["name"], branch)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_ref(raw)

    def create_branch(self, branch: str, sha: str) -> ActionResult[GitRef]:
        try:
            raw = self.client.create_git_ref(
                self.repository["name"], {"ref": f"refs/heads/{branch}", "sha": sha}
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_ref(raw)

    def update_branch(self, branch: str, sha: str, force: bool = False) -> None:
        try:
            self.client.update_git_ref(
                self.repository["name"], branch, {"sha": sha, "force": force}
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    # Git blob operations

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        data: dict[str, Any] = {"content": content, "encoding": encoding}
        try:
            raw = self.client.create_git_blob(self.repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_blob(raw)

    # File content operations

    def get_file_content(self, path: str, ref: str | None = None) -> ActionResult[FileContent]:
        try:
            raw = self.client.get_file_content(self.repository["name"], path, ref)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_file_content(raw)

    # Commit operations

    def get_commit(self, sha: str) -> ActionResult[Commit]:
        try:
            raw = self.client.get_commit(self.repository["name"], sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_commit(raw)

    def get_commits(
        self,
        sha: str | None = None,
        path: str | None = None,
    ) -> list[ActionResult[Commit]]:
        try:
            raw_commits = self.client.get_commits(self.repository["name"], sha=sha, path=path)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_commit(c) for c in raw_commits]

    def compare_commits(self, start_sha: str, end_sha: str) -> ActionResult[CommitComparison]:
        try:
            raw = self.client.compare_commits(self.repository["name"], start_sha, end_sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_commit_comparison(raw)

    # Git data operations

    def get_tree(self, tree_sha: str, recursive: bool = True) -> ActionResult[GitTree]:
        try:
            raw = self.client.get_tree_full(self.repository["name"], tree_sha, recursive=recursive)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_tree(raw)

    def get_git_commit(self, sha: str) -> ActionResult[GitCommitObject]:
        try:
            raw = self.client.get_git_commit(self.repository["name"], sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_commit_object(raw)

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: str | None = None,
    ) -> ActionResult[GitTree]:
        data: dict[str, Any] = {"tree": tree}
        if base_tree is not None:
            data["base_tree"] = base_tree
        try:
            raw = self.client.create_git_tree(self.repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_tree(raw)

    def create_git_commit(
        self,
        message: str,
        tree_sha: str,
        parent_shas: list[str],
    ) -> ActionResult[GitCommitObject]:
        data: dict[str, Any] = {
            "message": message,
            "tree": tree_sha,
            "parents": parent_shas,
        }
        try:
            raw = self.client.create_git_commit(self.repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_commit_object(raw)

    # Expanded pull request operations

    def get_pull_request_files(self, pull_request_id: str) -> list[ActionResult[PullRequestFile]]:
        try:
            raw_files = self.client.get_pull_request_files(self.repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [
            ActionResult(data=_transform_pull_request_file(f), type="github", raw=f)
            for f in raw_files
        ]

    def get_pull_request_commits(
        self, pull_request_id: str
    ) -> list[ActionResult[PullRequestCommit]]:
        try:
            raw_commits = self.client.get_pull_request_commits(
                self.repository["name"], pull_request_id
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [
            ActionResult(data=_transform_pull_request_commit(c), type="github", raw=c)
            for c in raw_commits
        ]

    def get_pull_request_diff(self, pull_request_id: str) -> ActionResult[str]:
        try:
            resp = self.client.get_pull_request_diff(self.repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return ActionResult(
            data=resp.text,
            type="github",
            raw={},
        )

    def get_pull_requests(
        self, state: str = "open", head: str | None = None
    ) -> list[ActionResult[PullRequest]]:
        try:
            raw_prs = self.client.list_pull_requests(self.repository["name"], state, head)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_pull_request(pr) for pr in raw_prs]

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
        try:
            raw = self.client.create_pull_request(self.repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> ActionResult[PullRequest]:
        data: dict[str, Any] = {}
        if title is not None:
            data["title"] = title
        if body is not None:
            data["body"] = body
        if state is not None:
            data["state"] = state
        try:
            raw = self.client.update_pull_request(self.repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        try:
            self.client.create_review_request(
                self.repository["name"], pull_request_id, {"reviewers": reviewers}
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    # Review operations

    def create_review_comment(
        self,
        pull_request_id: str,
        body: str,
        commit_sha: str,
        path: str,
        line: int | None = None,
        side: ReviewSide | None = None,
        start_line: int | None = None,
        start_side: ReviewSide | None = None,
    ) -> ActionResult[ReviewComment]:
        data: dict[str, Any] = {
            "body": body,
            "commit_id": commit_sha,
            "path": path,
        }
        if line is not None:
            data["line"] = line
        if side is not None:
            data["side"] = side
        if start_line is not None:
            data["start_line"] = start_line
        if start_side is not None:
            data["start_side"] = start_side
        try:
            raw = self.client.create_review_comment(self.repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_review_comment(raw)

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]:
        data: dict[str, Any] = {
            "commit_id": commit_sha,
            "event": event,
            "comments": comments,
        }
        if body is not None:
            data["body"] = body
        try:
            raw = self.client.create_review(self.repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_review(raw)

    # Check run operations

    def create_check_run(
        self,
        name: str,
        head_sha: str,
        status: CheckRunStatus | None = None,
        conclusion: CheckRunConclusion | None = None,
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
            data["status"] = status
        if conclusion is not None:
            data["conclusion"] = conclusion
        if external_id is not None:
            data["external_id"] = external_id
        if started_at is not None:
            data["started_at"] = started_at
        if completed_at is not None:
            data["completed_at"] = completed_at
        if output is not None:
            data["output"] = output
        try:
            raw = self.client.create_check_run(self.repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    def get_check_run(self, check_run_id: str) -> ActionResult[CheckRun]:
        try:
            raw = self.client.get_check_run(self.repository["name"], check_run_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    def update_check_run(
        self,
        check_run_id: str,
        status: CheckRunStatus | None = None,
        conclusion: CheckRunConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        data: dict[str, Any] = {}
        if status is not None:
            data["status"] = status
        if conclusion is not None:
            data["conclusion"] = conclusion
        if output is not None:
            data["output"] = output
        try:
            raw = self.client.update_check_run(self.repository["name"], check_run_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    # GraphQL mutation operations

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        try:
            self.client.minimize_comment(comment_node_id, reason)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def resolve_review_thread(self, thread_node_id: str) -> None:
        try:
            self.client.resolve_review_thread(thread_node_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
