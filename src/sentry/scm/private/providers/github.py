from typing import Any

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.errors import SCMProviderException
from sentry.scm.types import (
    Author,
    CheckRun,
    CheckRunActionResult,
    CheckRunOutput,
    Comment,
    CommentActionResult,
    Commit,
    CommitActionResult,
    CommitAuthor,
    CommitComparison,
    CommitComparisonActionResult,
    CommitFile,
    FileContent,
    FileContentActionResult,
    GitBlob,
    GitBlobActionResult,
    GitCommitObject,
    GitCommitObjectActionResult,
    GitCommitTree,
    GitRef,
    GitRefActionResult,
    GitTree,
    GitTreeActionResult,
    InputTreeEntry,
    Provider,
    PullRequest,
    PullRequestActionResult,
    PullRequestBranch,
    PullRequestCommit,
    PullRequestCommitActionResult,
    PullRequestDiffActionResult,
    PullRequestFile,
    PullRequestFileActionResult,
    Reaction,
    ReactionResult,
    Referrer,
    Repository,
    Review,
    ReviewActionResult,
    ReviewComment,
    ReviewCommentActionResult,
    ReviewCommentInput,
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


def _transform_comment(raw: dict[str, Any]) -> CommentActionResult:
    return CommentActionResult(
        comment=Comment(
            id=str(raw["id"]),
            body=raw["body"],
            author=_transform_author(raw.get("user")),
        ),
        provider="github",
        raw=raw,
    )


def _transform_reaction(raw: dict[str, Any]) -> ReactionResult:
    return ReactionResult(
        id=str(raw["id"]),
        content=raw["content"],
        author=_transform_author(raw.get("user")),
    )


def _transform_git_ref(raw: dict[str, Any]) -> GitRefActionResult:
    obj = raw.get("object", raw)
    ref_str = raw.get("ref", "")
    return GitRefActionResult(
        git_ref=GitRef(
            ref=ref_str,
            sha=obj.get("sha", raw.get("commit", {}).get("sha", "")),
        ),
        provider="github",
        raw=raw,
    )


def _transform_git_blob(raw: dict[str, Any]) -> GitBlobActionResult:
    return GitBlobActionResult(
        git_blob=GitBlob(sha=raw["sha"]),
        provider="github",
        raw=raw,
    )


def _transform_file_content(raw: dict[str, Any]) -> FileContentActionResult:
    return FileContentActionResult(
        file_content=FileContent(
            path=raw["path"],
            sha=raw["sha"],
            content=raw.get("content", ""),
            encoding=raw.get("encoding", ""),
            size=raw["size"],
        ),
        provider="github",
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


def _transform_commit(raw: dict[str, Any]) -> CommitActionResult:
    commit_data = raw.get("commit", {})
    return CommitActionResult(
        commit=Commit(
            sha=raw["sha"],
            message=commit_data.get("message", ""),
            author=_transform_commit_author(commit_data.get("author")),
            files=[_transform_commit_file(f) for f in raw.get("files", [])],
        ),
        provider="github",
        raw=raw,
    )


def _transform_commit_comparison(raw: dict[str, Any]) -> CommitComparisonActionResult:
    return CommitComparisonActionResult(
        comparison=CommitComparison(
            ahead_by=raw.get("ahead_by", 0),
            behind_by=raw.get("behind_by", 0),
        ),
        provider="github",
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


def _transform_git_tree_from_list(raw_entries: list[dict[str, Any]]) -> GitTreeActionResult:
    """Transform the list returned by client.get_tree() (truncated flag unavailable)."""
    return GitTreeActionResult(
        git_tree=GitTree(
            tree=[_transform_tree_entry(e) for e in raw_entries],
            truncated=False,
        ),
        provider="github",
        raw={"tree": raw_entries},
    )


def _transform_git_tree(raw: dict[str, Any]) -> GitTreeActionResult:
    """Transform a full git tree API response (from create_git_tree)."""
    return GitTreeActionResult(
        git_tree=GitTree(
            tree=[_transform_tree_entry(e) for e in raw.get("tree", [])],
            truncated=raw.get("truncated", False),
        ),
        provider="github",
        raw=raw,
    )


def _transform_git_commit_object(raw: dict[str, Any]) -> GitCommitObjectActionResult:
    return GitCommitObjectActionResult(
        git_commit=GitCommitObject(
            sha=raw["sha"],
            tree=GitCommitTree(sha=raw["tree"]["sha"]),
            message=raw.get("message", ""),
        ),
        provider="github",
        raw=raw,
    )


def _transform_review_comment(raw: dict[str, Any]) -> ReviewCommentActionResult:
    return ReviewCommentActionResult(
        review_comment=ReviewComment(
            id=raw["id"],
            html_url=raw.get("html_url", ""),
            path=raw.get("path", ""),
            body=raw.get("body", ""),
        ),
        provider="github",
        raw=raw,
    )


def _transform_review(raw: dict[str, Any]) -> ReviewActionResult:
    return ReviewActionResult(
        review=Review(
            id=raw["id"],
            html_url=raw.get("html_url", ""),
        ),
        provider="github",
        raw=raw,
    )


def _transform_check_run(raw: dict[str, Any]) -> CheckRunActionResult:
    return CheckRunActionResult(
        check_run=CheckRun(
            id=raw["id"],
            name=raw.get("name", ""),
            status=raw.get("status", ""),
            conclusion=raw.get("conclusion"),
            html_url=raw.get("html_url", ""),
        ),
        provider="github",
        raw=raw,
    )


def _transform_graphql_author(raw_author: dict[str, Any] | None) -> Author | None:
    if raw_author is None:
        return None
    return Author(id=raw_author.get("login", ""), username=raw_author.get("login", ""))


def _transform_graphql_comment(raw: dict[str, Any]) -> CommentActionResult:
    return CommentActionResult(
        comment=Comment(
            id=raw["id"],
            body=raw.get("body", ""),
            author=_transform_graphql_author(raw.get("author")),
        ),
        provider="github",
        raw=raw,
    )


def _transform_graphql_pr_comments(raw: dict[str, Any]) -> list[CommentActionResult]:
    """Flatten GraphQL issue comments and review thread comments into a single list."""
    pr_data = raw.get("repository", {}).get("pullRequest", {})
    results: list[CommentActionResult] = []
    for node in pr_data.get("comments", {}).get("nodes", []):
        results.append(_transform_graphql_comment(node))
    for thread in pr_data.get("reviewThreads", {}).get("nodes", []):
        for node in thread.get("comments", {}).get("nodes", []):
            results.append(_transform_graphql_comment(node))
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


def _transform_pull_request(raw: dict[str, Any]) -> PullRequestActionResult:
    return PullRequestActionResult(
        pull_request=PullRequest(
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
        provider="github",
        raw=raw,
    )


class GitHubProvider(Provider):

    def __init__(self, client: GitHubApiClient) -> None:
        self.client = client

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool:
        from sentry.scm.helpers import is_rate_limited_with_allocation_policy

        return is_rate_limited_with_allocation_policy(
            organization_id,
            referrer,
            provider="github",
            window=3600,
            allocation_policy=REFERRER_ALLOCATION,
        )

    def get_issue_comments(
        self, repository: Repository, issue_id: str
    ) -> list[CommentActionResult]:
        try:
            raw_comments = self.client.get_issue_comments(repository["name"], issue_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_comment(c) for c in raw_comments]

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None:
        try:
            self.client.create_comment(repository["name"], issue_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestActionResult:
        try:
            raw = self.client.get_pull_request(repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[CommentActionResult]:
        owner, repo = repository["name"].split("/", 1)
        try:
            raw = self.client.get_pull_request_comments_graphql(
                owner,
                repo,
                int(pull_request_id),
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_graphql_pr_comments(raw)

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None:
        try:
            self.client.create_comment(repository["name"], pull_request_id, {"body": body})
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None:
        try:
            self.client.delete_issue_comment(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_issue_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> list[ReactionResult]:
        try:
            raw_reactions = self.client.get_comment_reactions(repository["name"], comment_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_reaction(r) for r in raw_reactions]

    def create_issue_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None:
        github_reaction = REACTION_MAP[reaction]
        try:
            self.client.create_comment_reaction(repository["name"], comment_id, github_reaction)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None:
        try:
            self.client.delete_comment_reaction(repository["name"], comment_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> list[ReactionResult]:
        return self.get_issue_comment_reactions(repository, comment_id)

    def create_pull_request_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None:
        return self.create_issue_comment_reaction(repository, comment_id, reaction)

    def delete_pull_request_comment_reaction(
        self, repository: Repository, comment_id: str, reaction_id: str
    ) -> None:
        return self.delete_issue_comment_reaction(repository, comment_id, reaction_id)

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[ReactionResult]:
        try:
            raw_reactions = self.client.get_issue_reactions(repository["name"], issue_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_reaction(r) for r in raw_reactions]

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        github_reaction = REACTION_MAP[reaction]
        try:
            self.client.create_issue_reaction(repository["name"], issue_id, github_reaction)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction_id: str
    ) -> None:
        try:
            self.client.delete_issue_reaction(repository["name"], issue_id, reaction_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def get_pull_request_reactions(
        self, repository: Repository, pull_request_id: str
    ) -> list[ReactionResult]:
        return self.get_issue_reactions(repository, pull_request_id)

    def create_pull_request_reaction(
        self, repository: Repository, pull_request_id: str, reaction: Reaction
    ) -> None:
        return self.create_issue_reaction(repository, pull_request_id, reaction)

    def delete_pull_request_reaction(
        self, repository: Repository, pull_request_id: str, reaction_id: str
    ) -> None:
        return self.delete_issue_reaction(repository, pull_request_id, reaction_id)

    # Branch operations

    def get_branch(self, repository: Repository, branch: str) -> GitRefActionResult:
        try:
            raw = self.client.get_branch(repository["name"], branch)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_ref(raw)

    def create_branch(self, repository: Repository, branch: str, sha: str) -> GitRefActionResult:
        try:
            raw = self.client.create_git_ref(
                repository["name"], {"ref": f"refs/heads/{branch}", "sha": sha}
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_ref(raw)

    def update_branch(
        self, repository: Repository, branch: str, sha: str, force: bool = False
    ) -> None:
        try:
            self.client.update_git_ref(repository["name"], branch, {"sha": sha, "force": force})
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    # Git blob operations

    def create_git_blob(
        self, repository: Repository, content: str, encoding: str
    ) -> GitBlobActionResult:
        data: dict[str, Any] = {"content": content, "encoding": encoding}
        try:
            raw = self.client.create_git_blob(repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_blob(raw)

    # File content operations

    def get_file_content(
        self, repository: Repository, path: str, ref: str | None = None
    ) -> FileContentActionResult:
        try:
            raw = self.client.get_file_content(repository["name"], path, ref)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_file_content(raw)

    # Commit operations

    def get_commit(self, repository: Repository, sha: str) -> CommitActionResult:
        try:
            raw = self.client.get_commit(repository["name"], sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_commit(raw)

    def get_commits(self, repository: Repository) -> list[CommitActionResult]:
        try:
            raw_commits = self.client.get_commits(repository["name"])
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_commit(c) for c in raw_commits]

    def compare_commits(
        self, repository: Repository, start_sha: str, end_sha: str
    ) -> CommitComparisonActionResult:
        try:
            raw = self.client.compare_commits(repository["name"], start_sha, end_sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_commit_comparison(raw)

    # Git data operations

    def get_tree(self, repository: Repository, tree_sha: str) -> GitTreeActionResult:
        try:
            raw_entries = self.client.get_tree(repository["name"], tree_sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_tree_from_list(raw_entries)

    def get_git_commit(self, repository: Repository, sha: str) -> GitCommitObjectActionResult:
        try:
            raw = self.client.get_git_commit(repository["name"], sha)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_commit_object(raw)

    def create_git_tree(
        self,
        repository: Repository,
        tree: list[InputTreeEntry],
        base_tree: str | None = None,
    ) -> GitTreeActionResult:
        data: dict[str, Any] = {"tree": tree}
        if base_tree is not None:
            data["base_tree"] = base_tree
        try:
            raw = self.client.create_git_tree(repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_tree(raw)

    def create_git_commit(
        self,
        repository: Repository,
        message: str,
        tree_sha: str,
        parent_shas: list[str],
    ) -> GitCommitObjectActionResult:
        data: dict[str, Any] = {
            "message": message,
            "tree": tree_sha,
            "parents": parent_shas,
        }
        try:
            raw = self.client.create_git_commit(repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_git_commit_object(raw)

    # Expanded pull request operations

    def get_pull_request_files(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestFileActionResult:
        try:
            raw_files = self.client.get_pull_request_files(repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return PullRequestFileActionResult(
            files=[_transform_pull_request_file(f) for f in raw_files],
            provider="github",
            raw=raw_files,
        )

    def get_pull_request_commits(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestCommitActionResult:
        try:
            raw_commits = self.client.get_pull_request_commits(repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return PullRequestCommitActionResult(
            commits=[_transform_pull_request_commit(c) for c in raw_commits],
            provider="github",
            raw=raw_commits,
        )

    def get_pull_request_diff(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestDiffActionResult:
        try:
            resp = self.client.get_pull_request_diff(repository["name"], pull_request_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return PullRequestDiffActionResult(
            diff=resp.text,
            provider="github",
        )

    def list_pull_requests(
        self, repository: Repository, state: str = "open", head: str | None = None
    ) -> list[PullRequestActionResult]:
        try:
            raw_prs = self.client.list_pull_requests(repository["name"], state, head)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return [_transform_pull_request(pr) for pr in raw_prs]

    def create_pull_request(
        self,
        repository: Repository,
        title: str,
        body: str,
        head: str,
        base: str,
        draft: bool = False,
    ) -> PullRequestActionResult:
        data: dict[str, Any] = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "draft": draft,
        }
        try:
            raw = self.client.create_pull_request(repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def update_pull_request(
        self,
        repository: Repository,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> PullRequestActionResult:
        data: dict[str, Any] = {}
        if title is not None:
            data["title"] = title
        if body is not None:
            data["body"] = body
        if state is not None:
            data["state"] = state
        try:
            raw = self.client.update_pull_request(repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_pull_request(raw)

    def request_review(
        self, repository: Repository, pull_request_id: str, reviewers: list[str]
    ) -> None:
        try:
            self.client.create_review_request(
                repository["name"], pull_request_id, {"reviewers": reviewers}
            )
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    # Review operations

    def create_review_comment(
        self,
        repository: Repository,
        pull_request_id: str,
        body: str,
        commit_sha: str,
        path: str,
        line: int | None = None,
        side: str | None = None,
        start_line: int | None = None,
        start_side: str | None = None,
    ) -> ReviewCommentActionResult:
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
            raw = self.client.create_review_comment(repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_review_comment(raw)

    def create_review(
        self,
        repository: Repository,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ReviewActionResult:
        data: dict[str, Any] = {
            "commit_id": commit_sha,
            "event": event,
            "comments": comments,
        }
        if body is not None:
            data["body"] = body
        try:
            raw = self.client.create_review(repository["name"], pull_request_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_review(raw)

    # Check run operations

    def create_check_run(
        self,
        repository: Repository,
        name: str,
        head_sha: str,
        status: str | None = None,
        conclusion: str | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult:
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
            raw = self.client.create_check_run(repository["name"], data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    def get_check_run(
        self,
        repository: Repository,
        check_run_id: str,
    ) -> CheckRunActionResult:
        try:
            raw = self.client.get_check_run(repository["name"], check_run_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    def update_check_run(
        self,
        repository: Repository,
        check_run_id: str,
        status: str | None = None,
        conclusion: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> CheckRunActionResult:
        data: dict[str, Any] = {}
        if status is not None:
            data["status"] = status
        if conclusion is not None:
            data["conclusion"] = conclusion
        if output is not None:
            data["output"] = output
        try:
            raw = self.client.update_check_run(repository["name"], check_run_id, data)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
        return _transform_check_run(raw)

    # GraphQL mutation operations

    def minimize_comment(self, repository: Repository, comment_node_id: str, reason: str) -> None:
        try:
            self.client.minimize_comment(comment_node_id, reason)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def resolve_review_thread(self, repository: Repository, thread_node_id: str) -> None:
        try:
            self.client.resolve_review_thread(thread_node_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e

    def delete_review_comment_graphql(self, repository: Repository, comment_node_id: str) -> None:
        try:
            self.client.delete_pull_request_review_comment(comment_node_id)
        except ApiError as e:
            raise SCMProviderException(str(e)) from e
