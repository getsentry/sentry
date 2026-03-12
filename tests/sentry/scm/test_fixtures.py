from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.integrations.models import Integration
from sentry.scm.private.provider import Provider
from sentry.scm.types import (
    ActionResult,
    BuildConclusion,
    BuildStatus,
    CheckRun,
    CheckRunOutput,
    Comment,
    Commit,
    CommitAuthor,
    CommitFile,
    FileContent,
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
    Review,
    ReviewComment,
    ReviewCommentInput,
    ReviewSide,
    TreeEntry,
)
from sentry.shared_integrations.exceptions import ApiError


def make_github_comment(
    comment_id: int = 1,
    body: str = "Test comment",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub comment API responses."""
    return {
        "id": comment_id,
        "body": body,
        "user": {"id": user_id, "login": username},
        "created_at": "2026-02-04T10:00:00Z",
        "updated_at": "2026-02-04T10:00:00Z",
    }


def make_github_pull_request(
    pr_id: int = 42,
    number: int = 1,
    title: str = "Test PR",
    body: str | None = "PR description",
    state: str = "open",
    merged: bool = False,
    url: str = "https://api.github.com/repos/test-org/test-repo/pulls/1",
    html_url: str = "https://github.com/test-org/test-repo/pull/1",
    head_sha: str = "abc123",
    base_sha: str = "def456",
    head_ref: str = "feature-branch",
    base_ref: str = "main",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub PR API responses."""
    return {
        "id": pr_id,
        "number": number,
        "title": title,
        "body": body,
        "state": state,
        "merged": merged,
        "url": url,
        "html_url": html_url,
        "head": {"ref": head_ref, "sha": head_sha},
        "base": {"ref": base_ref, "sha": base_sha},
        "user": {"id": user_id, "login": username},
    }


def make_github_reaction(
    reaction_id: int = 1,
    content: str = "eyes",
    user_id: int = 123,
    username: str = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub reaction API responses."""
    return {
        "id": reaction_id,
        "content": content,
        "user": {"id": user_id, "login": username},
    }


def make_github_branch(
    branch: str = "main",
    sha: str = "abc123def456",
) -> dict[str, Any]:
    """Factory for GitHub branch API responses."""
    return {
        "name": branch,
        "commit": {"sha": sha},
    }


def make_github_git_ref(
    ref: str = "refs/heads/main",
    sha: str = "abc123def456",
) -> dict[str, Any]:
    """Factory for GitHub git ref API responses."""
    return {
        "ref": ref,
        "object": {"sha": sha, "type": "commit"},
    }


def make_github_git_blob(
    sha: str = "blob123abc",
) -> dict[str, Any]:
    """Factory for GitHub git blob API responses."""
    return {
        "sha": sha,
        "url": f"https://api.github.com/repos/test-org/test-repo/git/blobs/{sha}",
    }


def make_github_file_content(
    path: str = "README.md",
    sha: str = "abc123",
    content: str = "SGVsbG8gV29ybGQ=",
    encoding: str = "base64",
    size: int = 11,
) -> dict[str, Any]:
    """Factory for GitHub file content API responses."""
    return {
        "path": path,
        "sha": sha,
        "content": content,
        "encoding": encoding,
        "size": size,
        "type": "file",
    }


def make_github_commit_file(
    filename: str = "src/main.py",
    status: str = "modified",
    patch: str | None = "@@ -1,3 +1,4 @@\n+new line",
) -> dict[str, Any]:
    """Factory for GitHub commit file entries."""
    result: dict[str, Any] = {"filename": filename, "status": status}
    if patch is not None:
        result["patch"] = patch
    return result


def make_github_commit(
    sha: str = "abc123",
    message: str = "Fix bug",
    author_name: str = "Test User",
    author_email: str = "test@example.com",
    author_date: str = "2026-02-04T10:00:00Z",
    files: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Factory for GitHub commit API responses."""
    return {
        "sha": sha,
        "commit": {
            "message": message,
            "author": {
                "name": author_name,
                "email": author_email,
                "date": author_date,
            },
        },
        "files": files if files is not None else [make_github_commit_file()],
    }


def make_github_commit_comparison(
    ahead_by: int = 3,
    behind_by: int = 1,
    commits: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Factory for GitHub commit comparison API responses."""
    return {
        "ahead_by": ahead_by,
        "behind_by": behind_by,
        "commits": commits if commits is not None else [],
    }


def make_github_tree_entry(
    path: str = "src/main.py",
    mode: str = "100644",
    entry_type: str = "blob",
    sha: str = "abc123",
    size: int | None = 1234,
) -> dict[str, Any]:
    """Factory for GitHub tree entry objects."""
    result: dict[str, Any] = {
        "path": path,
        "mode": mode,
        "type": entry_type,
        "sha": sha,
    }
    if size is not None:
        result["size"] = size
    return result


def make_github_git_tree(
    sha: str = "tree_sha_abc",
    entries: list[dict[str, Any]] | None = None,
    truncated: bool = False,
) -> dict[str, Any]:
    """Factory for GitHub git tree API responses."""
    return {
        "sha": sha,
        "tree": entries if entries is not None else [make_github_tree_entry()],
        "truncated": truncated,
    }


def make_github_git_commit_object(
    sha: str = "abc123",
    tree_sha: str = "tree456",
    message: str = "Initial commit",
) -> dict[str, Any]:
    """Factory for GitHub git commit object API responses."""
    return {
        "sha": sha,
        "tree": {"sha": tree_sha},
        "message": message,
    }


def make_github_pull_request_file(
    filename: str = "src/main.py",
    status: str = "modified",
    patch: str | None = "@@ -1,3 +1,4 @@\n+new line",
    changes: int = 1,
    sha: str = "file123",
    previous_filename: str | None = None,
) -> dict[str, Any]:
    """Factory for GitHub pull request file API responses."""
    result: dict[str, Any] = {
        "filename": filename,
        "status": status,
        "changes": changes,
        "sha": sha,
    }
    if patch is not None:
        result["patch"] = patch
    if previous_filename is not None:
        result["previous_filename"] = previous_filename
    return result


def make_github_pull_request_commit(
    sha: str = "commit123",
    message: str = "Fix bug",
    author_name: str = "Test User",
    author_email: str = "test@example.com",
    author_date: str = "2026-02-04T10:00:00Z",
    author_login: str | None = "testuser",
) -> dict[str, Any]:
    """Factory for GitHub pull request commit API responses."""
    result: dict[str, Any] = {
        "sha": sha,
        "commit": {
            "message": message,
            "author": {
                "name": author_name,
                "email": author_email,
                "date": author_date,
            },
        },
    }
    if author_login is not None:
        result["author"] = {"login": author_login}
    else:
        result["author"] = None
    return result


def make_github_review_comment(
    comment_id: int = 100,
    html_url: str = "https://github.com/test-org/test-repo/pull/1#discussion_r100",
    path: str = "src/main.py",
    body: str = "Looks good",
) -> dict[str, Any]:
    """Factory for GitHub review comment API responses."""
    return {
        "id": comment_id,
        "html_url": html_url,
        "path": path,
        "body": body,
    }


def make_github_review(
    review_id: int = 200,
    html_url: str = "https://github.com/test-org/test-repo/pull/1#pullrequestreview-200",
) -> dict[str, Any]:
    """Factory for GitHub review API responses."""
    return {
        "id": review_id,
        "html_url": html_url,
    }


def make_github_check_run(
    check_run_id: int = 300,
    name: str = "Seer Review",
    status: str = "completed",
    conclusion: str | None = "success",
    html_url: str = "https://github.com/test-org/test-repo/runs/300",
) -> dict[str, Any]:
    """Factory for GitHub check run API responses."""
    return {
        "id": check_run_id,
        "name": name,
        "status": status,
        "conclusion": conclusion,
        "html_url": html_url,
    }


def make_github_graphql_issue_comment(
    node_id: str = "IC_abc123",
    body: str = "Test issue comment",
    is_minimized: bool = False,
    author_login: str = "testuser",
    author_database_id: int = 123,
    author_typename: str = "User",
) -> dict[str, Any]:
    """Factory for GraphQL issue comment nodes."""
    return {
        "id": node_id,
        "body": body,
        "isMinimized": is_minimized,
        "author": {
            "login": author_login,
            "databaseId": author_database_id,
            "__typename": author_typename,
        },
    }


def make_github_graphql_review_thread_comment(
    node_id: str = "PRRC_abc123",
    full_database_id: int | None = 12345,
    url: str = "https://github.com/test-org/test-repo/pull/1#discussion_r100",
    body: str = "Review thread comment",
    is_minimized: bool = False,
    path: str | None = "src/main.py",
    start_line: int | None = 1,
    line: int | None = 5,
    diff_hunk: str | None = "@@ -1,3 +1,4 @@",
    created_at: str | None = "2026-02-04T10:00:00Z",
    updated_at: str | None = "2026-02-04T10:00:00Z",
    reactions: list[dict[str, Any]] | None = None,
    reactions_total_count: int = 0,
    author_login: str = "reviewer",
    author_database_id: int = 456,
    author_typename: str = "User",
) -> dict[str, Any]:
    """Factory for GraphQL review thread comment nodes."""
    return {
        "id": node_id,
        "fullDatabaseId": full_database_id,
        "url": url,
        "body": body,
        "isMinimized": is_minimized,
        "path": path,
        "startLine": start_line,
        "line": line,
        "diffHunk": diff_hunk,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "reactions": {
            "nodes": reactions if reactions is not None else [],
            "totalCount": reactions_total_count,
        },
        "author": {
            "login": author_login,
            "databaseId": author_database_id,
            "__typename": author_typename,
        },
    }


def make_github_graphql_review_thread(
    node_id: str = "PRT_abc123",
    is_collapsed: bool = False,
    is_outdated: bool = False,
    is_resolved: bool = False,
    comments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Factory for GraphQL review thread nodes."""
    return {
        "id": node_id,
        "isCollapsed": is_collapsed,
        "isOutdated": is_outdated,
        "isResolved": is_resolved,
        "comments": {
            "nodes": (
                comments if comments is not None else [make_github_graphql_review_thread_comment()]
            ),
        },
    }


def make_github_graphql_pr_comments_response(
    issue_comments: list[dict[str, Any]] | None = None,
    review_threads: list[dict[str, Any]] | None = None,
    comments_has_next_page: bool = False,
    comments_end_cursor: str | None = None,
    threads_has_next_page: bool = False,
    threads_end_cursor: str | None = None,
) -> dict[str, Any]:
    """Factory for a full GraphQL PR comments response (the 'data' dict)."""
    return {
        "repository": {
            "pullRequest": {
                "comments": {
                    "nodes": (
                        issue_comments
                        if issue_comments is not None
                        else [make_github_graphql_issue_comment()]
                    ),
                    "pageInfo": {
                        "hasNextPage": comments_has_next_page,
                        "endCursor": comments_end_cursor,
                    },
                },
                "reviewThreads": {
                    "nodes": (
                        review_threads
                        if review_threads is not None
                        else [make_github_graphql_review_thread()]
                    ),
                    "pageInfo": {
                        "hasNextPage": threads_has_next_page,
                        "endCursor": threads_end_cursor,
                    },
                },
            }
        }
    }


_DEFAULT_PAGINATED_META: PaginatedResponseMeta = PaginatedResponseMeta(next_cursor=None)


class BaseTestProvider(Provider):
    organization_id: int
    repository: Repository

    def is_rate_limited(self, referrer: Referrer) -> bool:
        return False

    # Pull request

    def get_pull_request(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[PullRequest]:
        raw = make_github_pull_request()
        return ActionResult(
            data=PullRequest(
                id=str(raw["id"]),
                number=raw["number"],
                title=raw["title"],
                body=raw["body"],
                state=raw["state"],
                merged=raw["merged"],
                html_url=raw["html_url"],
                head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
                base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
            ),
            type="github",
            raw=raw,
            meta={},
        )

    # Issue comments

    def get_issue_comments(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        return PaginatedActionResult(
            data=[
                Comment(
                    id="101",
                    body="Test comment",
                    author={"id": "1", "username": "testuser"},
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_issue_comment(self, issue_id: str, body: str) -> ActionResult[Comment]:
        return ActionResult(
            data=Comment(id="101", body=body, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_issue_comment(self, issue_id: str, comment_id: str) -> None:
        return None

    # Pull request comments

    def get_pull_request_comments(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Comment]:
        return PaginatedActionResult(
            data=[
                Comment(
                    id="201",
                    body="PR review comment",
                    author={"id": "2", "username": "reviewer"},
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_pull_request_comment(self, pull_request_id: str, body: str) -> ActionResult[Comment]:
        return ActionResult(
            data=Comment(id="201", body=body, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_pull_request_comment(self, pull_request_id: str, comment_id: str) -> None:
        return None

    # Issue comment reactions

    def get_issue_comment_reactions(
        self,
        issue_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return PaginatedActionResult(
            data=[
                ReactionResult(id="1", content="+1", author={"id": "1", "username": "testuser"}),
                ReactionResult(id="2", content="eyes", author={"id": "2", "username": "otheruser"}),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return ActionResult(
            data=ReactionResult(id="1", content=reaction, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_issue_comment_reaction(
        self, issue_id: str, comment_id: str, reaction_id: str
    ) -> None:
        return None

    # Pull request comment reactions

    def get_pull_request_comment_reactions(
        self,
        pull_request_id: str,
        comment_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return PaginatedActionResult(
            data=[
                ReactionResult(
                    id="3", content="rocket", author={"id": "1", "username": "testuser"}
                ),
                ReactionResult(
                    id="4", content="hooray", author={"id": "2", "username": "otheruser"}
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return ActionResult(
            data=ReactionResult(id="1", content=reaction, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_pull_request_comment_reaction(
        self, pull_request_id: str, comment_id: str, reaction_id: str
    ) -> None:
        return None

    # Issue reactions

    def get_issue_reactions(
        self,
        issue_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return PaginatedActionResult(
            data=[
                ReactionResult(id="1", content="+1", author={"id": "1", "username": "testuser"}),
                ReactionResult(
                    id="2", content="heart", author={"id": "2", "username": "otheruser"}
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_issue_reaction(
        self, issue_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return ActionResult(
            data=ReactionResult(id="1", content=reaction, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_issue_reaction(self, issue_id: str, reaction_id: str) -> None:
        return None

    # Pull request reactions

    def get_pull_request_reactions(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[ReactionResult]:
        return PaginatedActionResult(
            data=[
                ReactionResult(id="5", content="laugh", author={"id": "1", "username": "testuser"}),
                ReactionResult(
                    id="6", content="confused", author={"id": "2", "username": "otheruser"}
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_pull_request_reaction(
        self, pull_request_id: str, reaction: Reaction
    ) -> ActionResult[ReactionResult]:
        return ActionResult(
            data=ReactionResult(id="1", content=reaction, author=None),
            type="github",
            raw={},
            meta={},
        )

    def delete_pull_request_reaction(self, pull_request_id: str, reaction_id: str) -> None:
        return None

    # Branch operations

    def get_branch(
        self,
        branch: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitRef]:
        return ActionResult(
            data=GitRef(ref=f"refs/heads/{branch}", sha="abc123def456"),
            type="github",
            raw={},
            meta={},
        )

    def create_branch(self, branch: str, sha: str) -> ActionResult[GitRef]:
        return ActionResult(
            data=GitRef(ref=branch, sha=sha),
            type="github",
            raw={},
            meta={},
        )

    def update_branch(self, branch: str, sha: str, force: bool = False) -> ActionResult[GitRef]:
        return ActionResult(
            data=GitRef(ref=branch, sha=sha),
            type="github",
            raw={},
            meta={},
        )

    # Git blob operations

    def create_git_blob(self, content: str, encoding: str) -> ActionResult[GitBlob]:
        return ActionResult(
            data=GitBlob(sha="blob123abc"),
            type="github",
            raw={},
            meta={},
        )

    # File content operations

    def get_file_content(
        self,
        path: str,
        ref: str | None = None,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[FileContent]:
        return ActionResult(
            data=FileContent(
                path=path,
                sha="abc123",
                content="SGVsbG8gV29ybGQ=",
                encoding="base64",
                size=11,
            ),
            type="github",
            raw={},
            meta={},
        )

    # Commit operations

    def get_commit(
        self,
        sha: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[Commit]:
        return ActionResult(
            data=Commit(
                id=sha,
                message="Fix bug",
                author=CommitAuthor(
                    name="Test User",
                    email="test@example.com",
                    date=datetime.fromisoformat("2026-02-04T10:00:00Z"),
                ),
                files=[CommitFile(filename="src/main.py", status="modified", patch="@@ -1 +1 @@")],
            ),
            type="github",
            raw={},
            meta={},
        )

    def get_commits(
        self,
        sha: str | None = None,
        path: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        inner = self.get_commit("abc123")
        return PaginatedActionResult(
            data=[inner["data"]],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def compare_commits(
        self,
        start_sha: str,
        end_sha: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[Commit]:
        inner = self.get_commit("abc123")
        return PaginatedActionResult(
            data=[inner["data"]],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    # Git data operations

    def get_tree(
        self,
        tree_sha: str,
        recursive: bool = True,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitTree]:
        return ActionResult(
            data=GitTree(
                sha=tree_sha,
                tree=[
                    TreeEntry(
                        path="src/main.py", mode="100644", type="blob", sha="abc123", size=1234
                    )
                ],
                truncated=False,
            ),
            type="github",
            raw={},
            meta={},
        )

    def get_git_commit(
        self,
        sha: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[GitCommitObject]:
        return ActionResult(
            data=GitCommitObject(
                sha=sha,
                tree=GitCommitTree(sha="tree456"),
                message="Initial commit",
            ),
            type="github",
            raw={},
            meta={},
        )

    def create_git_tree(
        self,
        tree: list[InputTreeEntry],
        base_tree: str | None = None,
    ) -> ActionResult[GitTree]:
        return ActionResult(
            data=GitTree(
                sha="newtree123",
                tree=[
                    TreeEntry(
                        path="src/main.py", mode="100644", type="blob", sha="new123", size=100
                    )
                ],
                truncated=False,
            ),
            type="github",
            raw={},
            meta={},
        )

    def create_git_commit(
        self,
        message: str,
        tree_sha: str,
        parent_shas: list[str],
    ) -> ActionResult[GitCommitObject]:
        return ActionResult(
            data=GitCommitObject(
                sha="newcommit123",
                tree=GitCommitTree(sha=tree_sha),
                message=message,
            ),
            type="github",
            raw={},
            meta={},
        )

    # Expanded pull request operations

    def get_pull_request_files(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestFile]:
        return PaginatedActionResult(
            data=[
                PullRequestFile(
                    filename="src/main.py",
                    status="modified",
                    patch="@@ -1 +1 @@",
                    changes=1,
                    sha="file123",
                    previous_filename=None,
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def get_pull_request_commits(
        self,
        pull_request_id: str,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequestCommit]:
        return PaginatedActionResult(
            data=[
                PullRequestCommit(
                    sha="commit123",
                    message="Fix bug",
                    author=CommitAuthor(
                        name="Test User",
                        email="test@example.com",
                        date=datetime.fromisoformat("2026-02-04T10:00:00Z"),
                    ),
                ),
            ],
            type="github",
            raw={},
            meta=_DEFAULT_PAGINATED_META,
        )

    def get_pull_request_diff(
        self,
        pull_request_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[str]:
        return ActionResult(
            data="diff --git a/file.py b/file.py\n--- a/file.py\n+++ b/file.py\n@@ -1 +1 @@\n-old\n+new",
            type="github",
            raw={},
            meta={},
        )

    def get_pull_requests(
        self,
        state: PullRequestState | None = "open",
        head: str | None = None,
        pagination: PaginationParams | None = None,
        request_options: RequestOptions | None = None,
    ) -> PaginatedActionResult[PullRequest]:
        raw = make_github_pull_request()
        return PaginatedActionResult(
            data=[
                PullRequest(
                    id=str(raw["id"]),
                    number=raw["number"],
                    title=raw["title"],
                    body=raw["body"],
                    state=raw["state"],
                    merged=raw["merged"],
                    html_url=raw["html_url"],
                    head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
                    base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
                ),
            ],
            type="github",
            raw=raw,
            meta=_DEFAULT_PAGINATED_META,
        )

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str,
        draft: bool = False,
    ) -> ActionResult[PullRequest]:
        raw = make_github_pull_request(title=title, body=body)
        return ActionResult(
            data=PullRequest(
                id=str(raw["id"]),
                number=raw["number"],
                title=raw["title"],
                body=raw["body"],
                state=raw["state"],
                merged=raw["merged"],
                html_url=raw["html_url"],
                head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
                base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def update_pull_request(
        self,
        pull_request_id: str,
        title: str | None = None,
        body: str | None = None,
        state: str | None = None,
    ) -> ActionResult[PullRequest]:
        raw = make_github_pull_request(
            title=title or "Test PR",
            body=body or "PR description",
            state=state or "open",
        )
        return ActionResult(
            data=PullRequest(
                id=str(raw["id"]),
                number=raw["number"],
                title=raw["title"],
                body=raw["body"],
                state=raw["state"],
                merged=raw["merged"],
                html_url=raw["html_url"],
                head=PullRequestBranch(sha=raw["head"]["sha"], ref=raw["head"]["ref"]),
                base=PullRequestBranch(sha=raw["base"]["sha"], ref=raw["base"]["ref"]),
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def request_review(self, pull_request_id: str, reviewers: list[str]) -> None:
        return None

    # Review operations

    def create_review_comment_file(
        self,
        pull_request_id: str,
        commit_id: str,
        body: str,
        path: str,
        side: ReviewSide,
    ) -> ActionResult[ReviewComment]:
        raw = make_github_review_comment(body=body, path=path)
        return ActionResult(
            data=ReviewComment(
                id=str(raw["id"]),
                html_url=raw["html_url"],
                path=raw["path"],
                body=raw["body"],
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def create_review_comment_reply(
        self,
        pull_request_id: str,
        body: str,
        comment_id: str,
    ) -> ActionResult[ReviewComment]:
        raw = make_github_review_comment(body=body)
        return ActionResult(
            data=ReviewComment(
                id=str(raw["id"]),
                html_url=raw["html_url"],
                path=raw["path"],
                body=raw["body"],
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def create_review(
        self,
        pull_request_id: str,
        commit_sha: str,
        event: str,
        comments: list[ReviewCommentInput],
        body: str | None = None,
    ) -> ActionResult[Review]:
        raw = make_github_review()
        return ActionResult(
            data=Review(id=str(raw["id"]), html_url=raw["html_url"]),
            type="github",
            raw=raw,
            meta={},
        )

    # Check run operations

    def create_check_run(
        self,
        name: str,
        head_sha: str,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        external_id: str | None = None,
        started_at: str | None = None,
        completed_at: str | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        raw = make_github_check_run(name=name)
        return ActionResult(
            data=CheckRun(
                id=str(raw["id"]),
                name=raw["name"],
                status=raw["status"],
                conclusion=raw["conclusion"],
                html_url=raw["html_url"],
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def get_check_run(
        self,
        check_run_id: str,
        request_options: RequestOptions | None = None,
    ) -> ActionResult[CheckRun]:
        raw = make_github_check_run()
        return ActionResult(
            data=CheckRun(
                id=str(raw["id"]),
                name=raw["name"],
                status=raw["status"],
                conclusion=raw["conclusion"],
                html_url=raw["html_url"],
            ),
            type="github",
            raw=raw,
            meta={},
        )

    def update_check_run(
        self,
        check_run_id: str,
        status: BuildStatus | None = None,
        conclusion: BuildConclusion | None = None,
        output: CheckRunOutput | None = None,
    ) -> ActionResult[CheckRun]:
        raw = make_github_check_run(
            status=status or "completed",
            conclusion=conclusion,
        )
        return ActionResult(
            data=CheckRun(
                id=str(raw["id"]),
                name=raw["name"],
                status=raw["status"],
                conclusion=raw["conclusion"],
                html_url=raw["html_url"],
            ),
            type="github",
            raw=raw,
            meta={},
        )

    # GraphQL mutation operations

    def minimize_comment(self, comment_node_id: str, reason: str) -> None:
        return None


class FakeGitHubApiClient(GitHubApiClient):
    """
    A fake GitHubApiClient for testing GitHubProvider without HTTP mocking.

    Configure responses by setting the corresponding attributes before calling
    provider methods. Use `raise_api_error` to simulate API failures.
    """

    def __init__(self) -> None:
        super().__init__(integration=MagicMock(spec=Integration))
        self.issue_comments: list[dict[str, Any]] = []
        self.pr_comments: list[dict[str, Any]] = []
        self.graphql_pr_comments_data: dict[str, Any] | None = None
        self.minimize_comment_data: dict[str, Any] | None = None
        self.resolve_thread_data: dict[str, Any] | None = None
        self.delete_review_comment_data: dict[str, Any] | None = None
        self.pull_request_data: dict[str, Any] | None = None
        self.comment_reactions: list[dict[str, Any]] = []
        self.issue_reactions: list[dict[str, Any]] = []
        self.git_blob_data: dict[str, Any] | None = None
        self.file_content_data: dict[str, Any] | None = None
        self.commit_data: dict[str, Any] | None = None
        self.commits_data: list[dict[str, Any]] | None = None
        self.comparison_data: dict[str, Any] | None = None
        self.tree_data: list[dict[str, Any]] | None = None
        self.tree_full_data: dict[str, Any] | None = None
        self.git_commit_data: dict[str, Any] | None = None
        self.created_tree_data: dict[str, Any] | None = None
        self.created_commit_data: dict[str, Any] | None = None
        self.pr_files_data: list[dict[str, Any]] | None = None
        self.pr_commits_data: list[dict[str, Any]] | None = None
        self.pr_diff_data: str = "diff --git a/f.py b/f.py"
        self.pull_requests_data: list[dict[str, Any]] | None = None
        self.created_pr_data: dict[str, Any] | None = None
        self.updated_pr_data: dict[str, Any] | None = None
        self.review_comment_data: dict[str, Any] | None = None
        self.review_data: dict[str, Any] | None = None
        self.check_run_data: dict[str, Any] | None = None
        self.updated_check_run_data: dict[str, Any] | None = None

        self.raise_api_error: bool = False
        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def _record_call(self, method: str, *args: Any, **kwargs: Any) -> None:
        self.calls.append((method, args, kwargs))

    def _maybe_raise(self) -> None:
        if self.raise_api_error:
            raise ApiError("Fake API error")

    def get_issue_comments(self, repo: str, issue_number: str) -> list[dict[str, Any]]:
        self._record_call("get_issue_comments", repo, issue_number)
        self._maybe_raise()
        return self.issue_comments

    def get_pull_request(self, repo: str, pull_number: str) -> dict[str, Any]:
        self._record_call("get_pull_request", repo, pull_number)
        self._maybe_raise()
        if self.pull_request_data is None:
            return make_github_pull_request()
        return self.pull_request_data

    def get_pull_request_comments(self, repo: str, pull_number: str) -> list[dict[str, Any]]:
        self._record_call("get_pull_request_comments", repo, pull_number)
        self._maybe_raise()
        return self.pr_comments

    def get_pull_request_comments_graphql(
        self,
        owner: str,
        repo: str,
        pr_number: int,
        *,
        comments_after: str | None = None,
        include_comments: bool = True,
        review_threads_after: str | None = None,
        include_threads: bool = True,
    ) -> dict[str, Any]:
        self._record_call(
            "get_pull_request_comments_graphql",
            owner,
            repo,
            pr_number,
            comments_after=comments_after,
            include_comments=include_comments,
            review_threads_after=review_threads_after,
            include_threads=include_threads,
        )
        self._maybe_raise()
        if self.graphql_pr_comments_data is not None:
            return self.graphql_pr_comments_data
        return make_github_graphql_pr_comments_response()

    def minimize_comment(self, comment_node_id: str, reason: str) -> dict[str, Any]:
        self._record_call("minimize_comment", comment_node_id, reason)
        self._maybe_raise()
        if self.minimize_comment_data is not None:
            return self.minimize_comment_data
        return {"minimizeComment": {"minimizedComment": {"isMinimized": True}}}

    def delete_pull_request_review_comment(self, comment_node_id: str) -> dict[str, Any]:
        self._record_call("delete_pull_request_review_comment", comment_node_id)
        self._maybe_raise()
        if self.delete_review_comment_data is not None:
            return self.delete_review_comment_data
        return {"deletePullRequestReviewComment": {"clientMutationId": None}}

    def create_comment(self, repo: str, issue_id: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_comment", repo, issue_id, data)
        self._maybe_raise()
        return make_github_comment(body=data.get("body", ""))

    def delete(self, path: str) -> None:
        self._record_call("delete", path)
        self._maybe_raise()

    def delete_issue_comment(self, repo: str, comment_id: str) -> None:
        self._record_call("delete_issue_comment", repo, comment_id)
        self._maybe_raise()

    def delete_comment_reaction(self, repo: str, comment_id: str, reaction_id: str) -> None:
        self._record_call("delete_comment_reaction", repo, comment_id, reaction_id)
        self._maybe_raise()

    def get_comment_reactions(self, repo: str, comment_id: str) -> list[dict[str, Any]]:
        self._record_call("get_comment_reactions", repo, comment_id)
        self._maybe_raise()
        return self.comment_reactions

    def create_comment_reaction(
        self, repo: str, comment_id: str, reaction: GitHubReaction
    ) -> dict[str, Any]:
        self._record_call("create_comment_reaction", repo, comment_id, reaction)
        self._maybe_raise()
        return make_github_reaction(content=reaction.value)

    def get_issue_reactions(self, repo: str, issue_number: str) -> list[dict[str, Any]]:
        self._record_call("get_issue_reactions", repo, issue_number)
        self._maybe_raise()
        return self.issue_reactions

    def create_issue_reaction(
        self, repo: str, issue_number: str, reaction: GitHubReaction
    ) -> dict[str, Any]:
        self._record_call("create_issue_reaction", repo, issue_number, reaction)
        self._maybe_raise()
        return make_github_reaction(content=reaction.value)

    def delete_issue_reaction(self, repo: str, issue_number: str, reaction_id: str) -> None:
        self._record_call("delete_issue_reaction", repo, issue_number, reaction_id)
        self._maybe_raise()

    def get_branch(self, repo: str, branch: str) -> dict[str, Any]:
        self._record_call("get_branch", repo, branch)
        self._maybe_raise()
        return make_github_branch(branch=branch)

    def get_git_ref(self, repo: str, ref: str) -> dict[str, Any]:
        self._record_call("get_git_ref", repo, ref)
        self._maybe_raise()
        return make_github_git_ref(ref=f"refs/heads/{ref}")

    def create_git_ref(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_git_ref", repo, data)
        self._maybe_raise()
        return make_github_git_ref(ref=data.get("ref", ""), sha=data.get("sha", ""))

    def update_git_ref(self, repo: str, ref: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("update_git_ref", repo, ref, data)
        self._maybe_raise()
        return make_github_git_ref(ref=f"refs/heads/{ref}", sha=data.get("sha", ""))

    def create_git_blob(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_git_blob", repo, data)
        self._maybe_raise()
        if self.git_blob_data is not None:
            return self.git_blob_data
        return make_github_git_blob()

    def get_file_content(self, repo: str, path: str, ref: str | None = None) -> dict[str, Any]:
        self._record_call("get_file_content", repo, path, ref)
        self._maybe_raise()
        if self.file_content_data is not None:
            return self.file_content_data
        return make_github_file_content(path=path)

    def get_commit(self, repo: str, sha: str) -> dict[str, Any]:
        self._record_call("get_commit", repo, sha)
        self._maybe_raise()
        if self.commit_data is not None:
            return self.commit_data
        return make_github_commit(sha=sha)

    def get_commits(
        self, repo: str, sha: str | None = None, path: str | None = None
    ) -> list[dict[str, Any]]:
        self._record_call("get_commits", repo, sha=sha, path=path)
        self._maybe_raise()
        if self.commits_data is not None:
            return self.commits_data
        return [make_github_commit()]

    def compare_commits(self, repo: str, start_sha: str, end_sha: str) -> Any:
        self._record_call("compare_commits", repo, start_sha, end_sha)
        self._maybe_raise()
        if self.comparison_data is not None:
            return self.comparison_data
        return [make_github_commit()]

    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        self._record_call("get_tree", repo_full_name, tree_sha)
        self._maybe_raise()
        if self.tree_data is not None:
            return self.tree_data
        return [make_github_tree_entry()]

    def get_tree_full(
        self, repo_full_name: str, tree_sha: str, recursive: bool = True
    ) -> dict[str, Any]:
        self._record_call("get_tree_full", repo_full_name, tree_sha, recursive=recursive)
        self._maybe_raise()
        if self.tree_full_data is not None:
            return self.tree_full_data
        return make_github_git_tree()

    def get_git_commit(self, repo: str, sha: str) -> dict[str, Any]:
        self._record_call("get_git_commit", repo, sha)
        self._maybe_raise()
        if self.git_commit_data is not None:
            return self.git_commit_data
        return make_github_git_commit_object(sha=sha)

    def create_git_tree(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_git_tree", repo, data)
        self._maybe_raise()
        if self.created_tree_data is not None:
            return self.created_tree_data
        return make_github_git_tree()

    def create_git_commit(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_git_commit", repo, data)
        self._maybe_raise()
        if self.created_commit_data is not None:
            return self.created_commit_data
        return make_github_git_commit_object(
            sha="newcommit123",
            tree_sha=data.get("tree", ""),
            message=data.get("message", ""),
        )

    def get_pull_request_files(self, repo: str, pull_number: str) -> list[dict[str, Any]]:
        self._record_call("get_pull_request_files", repo, pull_number)
        self._maybe_raise()
        if self.pr_files_data is not None:
            return self.pr_files_data
        return [make_github_pull_request_file()]

    def get_pull_request_commits(self, repo: str, pull_number: str) -> list[dict[str, Any]]:
        self._record_call("get_pull_request_commits", repo, pull_number)
        self._maybe_raise()
        if self.pr_commits_data is not None:
            return self.pr_commits_data
        return [make_github_pull_request_commit()]

    def get_pull_request_diff(self, repo: str, pull_number: str) -> Any:
        self._record_call("get_pull_request_diff", repo, pull_number)
        self._maybe_raise()
        return MagicMock(text=self.pr_diff_data)

    def list_pull_requests(
        self, repo: str, state: str = "open", head: str | None = None
    ) -> list[dict[str, Any]]:
        self._record_call("list_pull_requests", repo, state, head)
        self._maybe_raise()
        if self.pull_requests_data is not None:
            return self.pull_requests_data
        return [make_github_pull_request()]

    def create_pull_request(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_pull_request", repo, data)
        self._maybe_raise()
        if self.created_pr_data is not None:
            return self.created_pr_data
        return make_github_pull_request(
            title=data.get("title", "Test PR"),
            body=data.get("body", "PR description"),
        )

    def update_pull_request(
        self, repo: str, pull_number: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        self._record_call("update_pull_request", repo, pull_number, data)
        self._maybe_raise()
        if self.updated_pr_data is not None:
            return self.updated_pr_data
        return make_github_pull_request(
            title=data.get("title", "Test PR"),
            body=data.get("body", "PR description"),
            state=data.get("state", "open"),
        )

    def create_review_request(
        self, repo: str, pull_number: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        self._record_call("create_review_request", repo, pull_number, data)
        self._maybe_raise()
        return {}

    def create_review_comment(
        self, repo: str, pull_number: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        self._record_call("create_review_comment", repo, pull_number, data)
        self._maybe_raise()
        if self.review_comment_data is not None:
            return self.review_comment_data
        return make_github_review_comment(body=data.get("body", ""))

    def create_review(self, repo: str, pull_number: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_review", repo, pull_number, data)
        self._maybe_raise()
        if self.review_data is not None:
            return self.review_data
        return make_github_review()

    def create_check_run(self, repo: str, data: dict[str, Any]) -> dict[str, Any]:
        self._record_call("create_check_run", repo, data)
        self._maybe_raise()
        if self.check_run_data is not None:
            return self.check_run_data
        return make_github_check_run(name=data.get("name", ""))

    def get_check_run(self, repo: str, check_run_id: int) -> dict[str, Any]:
        self._record_call("get_check_run", repo, check_run_id)
        self._maybe_raise()
        if self.check_run_data is not None:
            return self.check_run_data
        return make_github_check_run()

    def update_check_run(
        self, repo: str, check_run_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        self._record_call("update_check_run", repo, check_run_id, data)
        self._maybe_raise()
        if self.updated_check_run_data is not None:
            return self.updated_check_run_data
        return make_github_check_run(
            status=data.get("status", "completed"),
            conclusion=data.get("conclusion"),
        )
