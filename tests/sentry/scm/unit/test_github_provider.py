from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

import pytest

from sentry.integrations.github.client import GitHubApiClient
from sentry.scm.private.providers.github import (
    MINIMIZE_COMMENT_MUTATION,
    GitHubProvider,
    GitHubProviderApiClient,
)
from sentry.scm.types import Repository
from tests.sentry.scm.test_fixtures import (
    make_github_branch,
    make_github_check_run,
    make_github_comment,
    make_github_commit,
    make_github_commit_comparison,
    make_github_file_content,
    make_github_git_blob,
    make_github_git_commit_object,
    make_github_git_ref,
    make_github_git_tree,
    make_github_pull_request,
    make_github_pull_request_commit,
    make_github_pull_request_file,
    make_github_reaction,
    make_github_review,
    make_github_review_comment,
)


def make_repository() -> Repository:
    return {
        "integration_id": 1,
        "name": "test-org/test-repo",
        "organization_id": 1,
        "is_active": True,
        "external_id": None,
    }


class FakeResponse:
    def __init__(
        self,
        payload: Any,
        *,
        headers: dict[str, str] | None = None,
        text: str | None = None,
        url: str = "",
    ) -> None:
        self._payload = payload
        self.headers = headers or {}
        self.text = text if text is not None else ""
        self.url = url

    def json(self) -> Any:
        return self._payload


class RecordingClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.responses: dict[str, list[Any]] = {
            "get": [],
            "post": [],
            "patch": [],
            "delete": [],
            "request": [],
            "graphql": [],
        }

    def queue(self, operation: str, response: Any) -> None:
        self.responses[operation].append(response)

    def _pop(self, operation: str) -> Any:
        if not self.responses[operation]:
            raise AssertionError(f"No queued response for {operation}")
        return self.responses[operation].pop(0)

    def get(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        pagination: Any | None = None,
        request_options: Any | None = None,
        extra_headers: dict[str, str] | None = None,
        allow_redirects: bool | None = None,
    ) -> FakeResponse:
        self.calls.append(
            {
                "operation": "get",
                "path": path,
                "params": params,
                "pagination": pagination,
                "request_options": request_options,
                "extra_headers": extra_headers,
            }
        )
        return self._pop("get")

    def post(
        self,
        path: str,
        data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> FakeResponse:
        self.calls.append({"operation": "post", "path": path, "data": data, "headers": headers})
        return self._pop("post")

    def patch(
        self,
        path: str,
        data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> FakeResponse:
        self.calls.append({"operation": "patch", "path": path, "data": data, "headers": headers})
        return self._pop("patch")

    def delete(self, path: str) -> FakeResponse:
        self.calls.append({"operation": "delete", "path": path})
        return self._pop("delete")

    def request(
        self,
        method: str,
        path: str,
        data: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> FakeResponse:
        self.calls.append(
            {
                "operation": "request",
                "method": method,
                "path": path,
                "data": data,
                "params": params,
                "headers": headers,
            }
        )
        return self._pop("request")

    def graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        self.calls.append({"operation": "graphql", "query": query, "variables": variables})
        return self._pop("graphql")


def make_provider(client: RecordingClient | None = None) -> tuple[GitHubProvider, RecordingClient]:
    transport = client or RecordingClient()
    provider = GitHubProvider(
        MagicMock(spec=GitHubApiClient),
        organization_id=1,
        repository=make_repository(),
    )
    provider.client = transport  # type: ignore[assignment]
    return provider, transport


def assert_action_result(result: Any, *, expected_data: Any, raw: Any) -> None:
    assert result["type"] == "github"
    assert result["raw"] == raw
    assert result["data"] == expected_data
    assert result["meta"] == {}


def assert_paginated_result(
    result: Any,
    *,
    expected_data: Any,
    raw: Any,
    next_cursor: str,
) -> None:
    assert result["type"] == "github"
    assert result["raw"] == raw
    assert result["data"] == expected_data
    assert result["meta"] == {"next_cursor": next_cursor}


def expected_comment(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw["id"]),
        "body": raw["body"],
        "author": {"id": str(raw["user"]["id"]), "username": raw["user"]["login"]},
    }


def expected_reaction(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw["id"]),
        "content": raw["content"],
        "author": {"id": str(raw["user"]["id"]), "username": raw["user"]["login"]},
    }


def expected_pull_request(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw["id"]),
        "number": str(raw["number"]),
        "title": raw["title"],
        "body": raw.get("body"),
        "state": raw["state"],
        "merged": raw.get("merged_at") is not None,
        "html_url": raw.get("html_url", ""),
        "head": {"sha": raw["head"]["sha"], "ref": raw["head"]["ref"]},
        "base": {"sha": raw["base"]["sha"], "ref": raw["base"]["ref"]},
    }


def expected_git_ref_from_branch(raw: dict[str, Any]) -> dict[str, Any]:
    return {"ref": raw["name"], "sha": raw["commit"]["sha"]}


def expected_git_ref(raw: dict[str, Any]) -> dict[str, Any]:
    return {"ref": raw["ref"].removeprefix("refs/heads/"), "sha": raw["object"]["sha"]}


def expected_file_content(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "path": raw["path"],
        "sha": raw["sha"],
        "content": raw.get("content", ""),
        "encoding": raw.get("encoding", ""),
        "size": raw["size"],
    }


def expected_commit(raw: dict[str, Any]) -> dict[str, Any]:
    author = raw["commit"]["author"]
    return {
        "id": raw["sha"],
        "message": raw["commit"]["message"],
        "author": {
            "name": author["name"],
            "email": author["email"],
            "date": datetime.fromisoformat(author["date"]),
        },
        "files": [
            {
                "filename": entry["filename"],
                "status": entry.get("status", "modified"),
                "patch": entry.get("patch"),
            }
            for entry in raw.get("files", [])
        ],
    }


def expected_tree(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "sha": raw["sha"],
        "tree": [
            {
                "path": entry["path"],
                "mode": entry["mode"],
                "type": entry["type"],
                "sha": entry["sha"],
                "size": entry.get("size"),
            }
            for entry in raw["tree"]
        ],
        "truncated": raw["truncated"],
    }


def expected_git_commit_object(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "sha": raw["sha"],
        "tree": {"sha": raw["tree"]["sha"]},
        "message": raw.get("message", ""),
    }


def expected_pull_request_file(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "filename": raw["filename"],
        "status": raw.get("status", "modified"),
        "patch": raw.get("patch"),
        "changes": raw.get("changes", 0),
        "sha": raw.get("sha", ""),
        "previous_filename": raw.get("previous_filename"),
    }


def expected_pull_request_commit(raw: dict[str, Any]) -> dict[str, Any]:
    author = raw["commit"]["author"]
    return {
        "sha": raw["sha"],
        "message": raw["commit"]["message"],
        "author": {
            "name": author["name"],
            "email": author["email"],
            "date": datetime.fromisoformat(author["date"]),
        },
    }


def expected_review_comment(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw["id"]),
        "html_url": raw["html_url"],
        "path": raw["path"],
        "body": raw["body"],
    }


def expected_review(raw: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(raw["id"]), "html_url": raw["html_url"]}


def expected_check_run(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw["id"]),
        "name": raw["name"],
        "status": "completed" if raw["status"] == "completed" else "pending",
        "conclusion": raw["conclusion"],
        "html_url": raw["html_url"],
    }


COMMENT_RAW = make_github_comment()
REACTION_RAW = make_github_reaction()
PULL_REQUEST_RAW = make_github_pull_request()
BRANCH_RAW = make_github_branch()
GIT_REF_RAW = make_github_git_ref()
GIT_BLOB_RAW = make_github_git_blob()
FILE_CONTENT_RAW = make_github_file_content()
COMMIT_RAW = make_github_commit()
COMPARISON_RAW = make_github_commit_comparison(commits=[COMMIT_RAW])
TREE_RAW = make_github_git_tree()
GIT_COMMIT_OBJECT_RAW = make_github_git_commit_object()
PULL_REQUEST_FILE_RAW = make_github_pull_request_file(previous_filename="src/old.py")
PULL_REQUEST_COMMIT_RAW = make_github_pull_request_commit()
REVIEW_COMMENT_RAW = make_github_review_comment()
REVIEW_RAW = make_github_review()
CHECK_RUN_RAW = make_github_check_run()


PAGINATED_CASES: list[dict[str, Any]] = [
    {
        "name": "get_issue_comments",
        "kwargs": {"issue_id": "42"},
        "path": "/repos/test-org/test-repo/issues/42/comments",
        "params": None,
        "pagination": None,
        "raw": [COMMENT_RAW],
        "expected_data": [expected_comment(COMMENT_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_pull_request_comments",
        "kwargs": {"pull_request_id": "42", "pagination": {"cursor": "4", "per_page": 25}},
        "path": "/repos/test-org/test-repo/issues/42/comments",
        "params": None,
        "pagination": {"cursor": "4", "per_page": 25},
        "raw": [COMMENT_RAW],
        "expected_data": [expected_comment(COMMENT_RAW)],
        "next_cursor": "5",
    },
    {
        "name": "get_issue_comment_reactions",
        "kwargs": {"issue_id": "42", "comment_id": "99"},
        "path": "/repos/test-org/test-repo/issues/comments/99/reactions",
        "params": None,
        "pagination": None,
        "raw": [REACTION_RAW],
        "expected_data": [expected_reaction(REACTION_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_issue_reactions",
        "kwargs": {"issue_id": "42"},
        "path": "/repos/test-org/test-repo/issues/42/reactions",
        "params": None,
        "pagination": None,
        "raw": [REACTION_RAW],
        "expected_data": [expected_reaction(REACTION_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_commits",
        "kwargs": {"ref": "main", "pagination": {"cursor": "3", "per_page": 10}},
        "path": "/repos/test-org/test-repo/commits",
        "params": {"sha": "main"},
        "pagination": {"cursor": "3", "per_page": 10},
        "raw": [COMMIT_RAW],
        "expected_data": [expected_commit(COMMIT_RAW)],
        "next_cursor": "4",
    },
    {
        "name": "get_commits_by_path",
        "kwargs": {"path": "src/main.py", "ref": "main"},
        "path": "/repos/test-org/test-repo/commits",
        "params": {"path": "src/main.py", "sha": "main"},
        "pagination": None,
        "raw": [COMMIT_RAW],
        "expected_data": [expected_commit(COMMIT_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "compare_commits",
        "kwargs": {"start_sha": "aaa", "end_sha": "bbb"},
        "path": "/repos/test-org/test-repo/compare/aaa...bbb",
        "params": None,
        "pagination": None,
        "raw": COMPARISON_RAW,
        "expected_data": [expected_commit(COMMIT_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_pull_request_files",
        "kwargs": {"pull_request_id": "42"},
        "path": "/repos/test-org/test-repo/pulls/42/files",
        "params": None,
        "pagination": None,
        "raw": [PULL_REQUEST_FILE_RAW],
        "expected_data": [expected_pull_request_file(PULL_REQUEST_FILE_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_pull_request_commits",
        "kwargs": {"pull_request_id": "42"},
        "path": "/repos/test-org/test-repo/pulls/42/commits",
        "params": None,
        "pagination": None,
        "raw": [PULL_REQUEST_COMMIT_RAW],
        "expected_data": [expected_pull_request_commit(PULL_REQUEST_COMMIT_RAW)],
        "next_cursor": "2",
    },
    {
        "name": "get_pull_requests",
        "kwargs": {
            "state": None,
            "head": "octocat:feature",
            "pagination": {"cursor": "2", "per_page": 15},
        },
        "path": "/repos/test-org/test-repo/pulls",
        "params": {"state": "all", "head": "octocat:feature"},
        "pagination": {"cursor": "2", "per_page": 15},
        "raw": [PULL_REQUEST_RAW],
        "expected_data": [expected_pull_request(PULL_REQUEST_RAW)],
        "next_cursor": "3",
    },
]


ACTION_CASES: list[dict[str, Any]] = [
    {
        "name": "create_issue_comment",
        "operation": "post",
        "kwargs": {"issue_id": "42", "body": "hello"},
        "path": "/repos/test-org/test-repo/issues/42/comments",
        "data": {"body": "hello"},
        "raw": COMMENT_RAW,
        "expected_data": expected_comment(COMMENT_RAW),
    },
    {
        "name": "get_pull_request",
        "operation": "get",
        "kwargs": {"pull_request_id": "42"},
        "path": "/repos/test-org/test-repo/pulls/42",
        "raw": PULL_REQUEST_RAW,
        "expected_data": expected_pull_request(PULL_REQUEST_RAW),
    },
    {
        "name": "create_pull_request_comment",
        "operation": "post",
        "kwargs": {"pull_request_id": "42", "body": "hello"},
        "path": "/repos/test-org/test-repo/issues/42/comments",
        "data": {"body": "hello"},
        "raw": COMMENT_RAW,
        "expected_data": expected_comment(COMMENT_RAW),
    },
    {
        "name": "create_issue_comment_reaction",
        "operation": "post",
        "kwargs": {"issue_id": "42", "comment_id": "99", "reaction": "heart"},
        "path": "/repos/test-org/test-repo/issues/comments/99/reactions",
        "data": {"content": "heart"},
        "raw": REACTION_RAW,
        "expected_data": expected_reaction(REACTION_RAW),
    },
    {
        "name": "create_issue_reaction",
        "operation": "post",
        "kwargs": {"issue_id": "42", "reaction": "rocket"},
        "path": "/repos/test-org/test-repo/issues/42/reactions",
        "data": {"content": "rocket"},
        "raw": REACTION_RAW,
        "expected_data": expected_reaction(REACTION_RAW),
    },
    {
        "name": "get_branch",
        "operation": "get",
        "kwargs": {"branch": "main"},
        "path": "/repos/test-org/test-repo/branches/main",
        "raw": BRANCH_RAW,
        "expected_data": expected_git_ref_from_branch(BRANCH_RAW),
    },
    {
        "name": "create_branch",
        "operation": "post",
        "kwargs": {"branch": "feature", "sha": "abc123"},
        "path": "/repos/test-org/test-repo/git/refs",
        "data": {"ref": "refs/heads/feature", "sha": "abc123"},
        "raw": GIT_REF_RAW,
        "expected_data": expected_git_ref(GIT_REF_RAW),
    },
    {
        "name": "update_branch",
        "operation": "patch",
        "kwargs": {"branch": "feature", "sha": "abc123", "force": True},
        "path": "/repos/test-org/test-repo/git/refs/heads/feature",
        "data": {"sha": "abc123", "force": True},
        "raw": GIT_REF_RAW,
        "expected_data": expected_git_ref(GIT_REF_RAW),
    },
    {
        "name": "create_git_blob",
        "operation": "post",
        "kwargs": {"content": "hello", "encoding": "utf-8"},
        "path": "/repos/test-org/test-repo/git/blobs",
        "data": {"content": "hello", "encoding": "utf-8"},
        "raw": GIT_BLOB_RAW,
        "expected_data": {"sha": GIT_BLOB_RAW["sha"]},
    },
    {
        "name": "get_file_content",
        "operation": "get",
        "kwargs": {"path": "README.md", "ref": "main"},
        "path": "/repos/test-org/test-repo/contents/README.md",
        "params": {"ref": "main"},
        "raw": FILE_CONTENT_RAW,
        "expected_data": expected_file_content(FILE_CONTENT_RAW),
    },
    {
        "name": "get_commit",
        "operation": "get",
        "kwargs": {"sha": "abc123"},
        "path": "/repos/test-org/test-repo/commits/abc123",
        "raw": COMMIT_RAW,
        "expected_data": expected_commit(COMMIT_RAW),
    },
    {
        "name": "get_tree",
        "operation": "get",
        "kwargs": {"tree_sha": "tree123", "recursive": False},
        "path": "/repos/test-org/test-repo/git/trees/tree123",
        "params": {},
        "raw": TREE_RAW,
        "expected_data": expected_tree(TREE_RAW),
    },
    {
        "name": "get_git_commit",
        "operation": "get",
        "kwargs": {"sha": "abc123"},
        "path": "/repos/test-org/test-repo/git/commits/abc123",
        "raw": GIT_COMMIT_OBJECT_RAW,
        "expected_data": expected_git_commit_object(GIT_COMMIT_OBJECT_RAW),
    },
    {
        "name": "create_git_tree",
        "operation": "post",
        "kwargs": {
            "tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "abc"}],
            "base_tree": "base123",
        },
        "path": "/repos/test-org/test-repo/git/trees",
        "data": {
            "tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "abc"}],
            "base_tree": "base123",
        },
        "raw": TREE_RAW,
        "expected_data": expected_tree(TREE_RAW),
    },
    {
        "name": "create_git_commit",
        "operation": "post",
        "kwargs": {"message": "msg", "tree_sha": "tree123", "parent_shas": ["p1", "p2"]},
        "path": "/repos/test-org/test-repo/git/commits",
        "data": {"message": "msg", "tree": "tree123", "parents": ["p1", "p2"]},
        "raw": GIT_COMMIT_OBJECT_RAW,
        "expected_data": expected_git_commit_object(GIT_COMMIT_OBJECT_RAW),
    },
    {
        "name": "create_pull_request",
        "operation": "post",
        "kwargs": {"title": "T", "body": "B", "head": "feature", "base": "main"},
        "path": "/repos/test-org/test-repo/pulls",
        "data": {"title": "T", "body": "B", "head": "feature", "base": "main"},
        "raw": PULL_REQUEST_RAW,
        "expected_data": expected_pull_request(PULL_REQUEST_RAW),
    },
    {
        "name": "create_pull_request_draft",
        "operation": "post",
        "kwargs": {"title": "T", "body": "B", "head": "feature", "base": "main"},
        "path": "/repos/test-org/test-repo/pulls",
        "data": {"title": "T", "body": "B", "head": "feature", "base": "main", "draft": True},
        "raw": PULL_REQUEST_RAW,
        "expected_data": expected_pull_request(PULL_REQUEST_RAW),
    },
    {
        "name": "update_pull_request",
        "operation": "patch",
        "kwargs": {"pull_request_id": "42", "title": "New", "body": "Body", "state": "closed"},
        "path": "/repos/test-org/test-repo/pulls/42",
        "data": {"title": "New", "body": "Body", "state": "closed"},
        "raw": PULL_REQUEST_RAW,
        "expected_data": expected_pull_request(PULL_REQUEST_RAW),
    },
    {
        "name": "create_review_comment_file",
        "operation": "post",
        "kwargs": {
            "pull_request_id": "42",
            "commit_id": "abc123",
            "body": "Looks good",
            "path": "src/main.py",
            "side": "RIGHT",
        },
        "path": "/repos/test-org/test-repo/pulls/42/comments",
        "data": {
            "body": "Looks good",
            "commit_id": "abc123",
            "path": "src/main.py",
            "side": "RIGHT",
            "subject_type": "file",
        },
        "raw": REVIEW_COMMENT_RAW,
        "expected_data": expected_review_comment(REVIEW_COMMENT_RAW),
    },
    {
        "name": "create_review_comment_reply",
        "operation": "post",
        "kwargs": {"pull_request_id": "42", "body": "reply", "comment_id": "99"},
        "path": "/repos/test-org/test-repo/pulls/42/comments",
        "data": {"body": "reply", "in_reply_to": 99},
        "raw": REVIEW_COMMENT_RAW,
        "expected_data": expected_review_comment(REVIEW_COMMENT_RAW),
    },
    {
        "name": "create_review",
        "operation": "post",
        "kwargs": {
            "pull_request_id": "42",
            "commit_sha": "abc123",
            "event": "approve",
            "comments": [{"path": "f.py", "body": "fix"}],
            "body": "overall",
        },
        "path": "/repos/test-org/test-repo/pulls/42/reviews",
        "data": {
            "commit_id": "abc123",
            "event": "APPROVE",
            "comments": [{"path": "f.py", "body": "fix"}],
            "body": "overall",
        },
        "raw": REVIEW_RAW,
        "expected_data": expected_review(REVIEW_RAW),
    },
    {
        "name": "create_check_run",
        "operation": "post",
        "kwargs": {
            "name": "Seer Review",
            "head_sha": "abc123",
            "status": "running",
            "conclusion": "success",
            "external_id": "ext-1",
            "started_at": "2026-02-04T10:00:00Z",
            "completed_at": "2026-02-04T10:05:00Z",
            "output": {"title": "Review", "summary": "All good"},
        },
        "path": "/repos/test-org/test-repo/check-runs",
        "data": {
            "name": "Seer Review",
            "head_sha": "abc123",
            "status": "in_progress",
            "conclusion": "success",
            "external_id": "ext-1",
            "started_at": "2026-02-04T10:00:00Z",
            "completed_at": "2026-02-04T10:05:00Z",
            "output": {"title": "Review", "summary": "All good"},
        },
        "raw": CHECK_RUN_RAW,
        "expected_data": expected_check_run(CHECK_RUN_RAW),
    },
    {
        "name": "get_check_run",
        "operation": "get",
        "kwargs": {"check_run_id": "300"},
        "path": "/repos/test-org/test-repo/check-runs/300",
        "raw": CHECK_RUN_RAW,
        "expected_data": expected_check_run(CHECK_RUN_RAW),
    },
    {
        "name": "update_check_run",
        "operation": "patch",
        "kwargs": {
            "check_run_id": "300",
            "status": "completed",
            "conclusion": "failure",
            "output": {"title": "Done", "summary": "Failed"},
        },
        "path": "/repos/test-org/test-repo/check-runs/300",
        "data": {
            "status": "completed",
            "conclusion": "failure",
            "output": {"title": "Done", "summary": "Failed"},
        },
        "raw": CHECK_RUN_RAW,
        "expected_data": expected_check_run(CHECK_RUN_RAW),
    },
    {
        "name": "get_archive_link",
        "id": "get_archive_link_tarball",
        "operation": "get",
        "kwargs": {"ref": "main"},
        "path": "/repos/test-org/test-repo/tarball/main",
        "url": "https://codeload.github.com/test-org/test-repo/legacy.tar.gz/refs/heads/main",
        "raw": "https://codeload.github.com/test-org/test-repo/legacy.tar.gz/refs/heads/main",
        "expected_data": {
            "url": "https://codeload.github.com/test-org/test-repo/legacy.tar.gz/refs/heads/main",
            "headers": {},
        },
    },
    {
        "name": "get_archive_link",
        "id": "get_archive_link_zip",
        "operation": "get",
        "kwargs": {"ref": "main", "archive_format": "zip"},
        "path": "/repos/test-org/test-repo/zipball/main",
        "url": "https://codeload.github.com/test-org/test-repo/legacy.zip/refs/heads/main",
        "raw": "https://codeload.github.com/test-org/test-repo/legacy.zip/refs/heads/main",
        "expected_data": {
            "url": "https://codeload.github.com/test-org/test-repo/legacy.zip/refs/heads/main",
            "headers": {},
        },
    },
]


VOID_CASES: list[dict[str, Any]] = [
    {
        "name": "delete_issue_comment",
        "operation": "delete",
        "kwargs": {"issue_id": "42", "comment_id": "99"},
        "path": "/repos/test-org/test-repo/issues/comments/99",
    },
    {
        "name": "delete_pull_request_comment",
        "operation": "delete",
        "kwargs": {"pull_request_id": "42", "comment_id": "99"},
        "path": "/repos/test-org/test-repo/issues/comments/99",
    },
    {
        "name": "delete_issue_comment_reaction",
        "operation": "delete",
        "kwargs": {"issue_id": "42", "comment_id": "99", "reaction_id": "5"},
        "path": "/repos/test-org/test-repo/issues/comments/99/reactions/5",
    },
    {
        "name": "delete_issue_reaction",
        "operation": "delete",
        "kwargs": {"issue_id": "42", "reaction_id": "5"},
        "path": "/repos/test-org/test-repo/issues/42/reactions/5",
    },
    {
        "name": "request_review",
        "operation": "post",
        "kwargs": {"pull_request_id": "42", "reviewers": ["octocat"]},
        "path": "/repos/test-org/test-repo/pulls/42/requested_reviewers",
        "data": {"reviewers": ["octocat"]},
    },
    {
        "name": "minimize_comment",
        "operation": "graphql",
        "kwargs": {"comment_node_id": "IC_123", "reason": "OUTDATED"},
        "query": MINIMIZE_COMMENT_MUTATION,
        "variables": {"commentId": "IC_123", "reason": "OUTDATED"},
    },
]


ALIAS_METHODS = {
    "get_pull_request_comment_reactions": (
        "get_issue_comment_reactions",
        {"pull_request_id": "42", "comment_id": "99", "pagination": {"cursor": "2", "per_page": 5}},
        ("42", "99", {"cursor": "2", "per_page": 5}, None),
        {"data": ["ok"], "type": "github", "raw": [], "meta": {"next_cursor": "3"}},
    ),
    "create_pull_request_comment_reaction": (
        "create_issue_comment_reaction",
        {"pull_request_id": "42", "comment_id": "99", "reaction": "heart"},
        ("42", "99", "heart"),
        {"data": {"id": "1"}, "type": "github", "raw": {}, "meta": {}},
    ),
    "delete_pull_request_comment_reaction": (
        "delete_issue_comment_reaction",
        {"pull_request_id": "42", "comment_id": "99", "reaction_id": "5"},
        ("42", "99", "5"),
        None,
    ),
    "get_pull_request_reactions": (
        "get_issue_reactions",
        {"pull_request_id": "42", "pagination": {"cursor": "2", "per_page": 5}},
        ("42", {"cursor": "2", "per_page": 5}, None),
        {"data": ["ok"], "type": "github", "raw": [], "meta": {"next_cursor": "3"}},
    ),
    "create_pull_request_reaction": (
        "create_issue_reaction",
        {"pull_request_id": "42", "reaction": "rocket"},
        ("42", "rocket"),
        {"data": {"id": "1"}, "type": "github", "raw": {}, "meta": {}},
    ),
    "delete_pull_request_reaction": (
        "delete_issue_reaction",
        {"pull_request_id": "42", "reaction_id": "5"},
        ("42", "5"),
        None,
    ),
}


@pytest.mark.parametrize("case", PAGINATED_CASES)
def test_paginated_methods(case: dict[str, Any]) -> None:
    provider, client = make_provider()
    client.queue("get", FakeResponse(case["raw"]))

    result = getattr(provider, case["name"])(**case["kwargs"])

    assert_paginated_result(
        result,
        expected_data=case["expected_data"],
        raw=case["raw"],
        next_cursor=case["next_cursor"],
    )
    assert client.calls == [
        {
            "operation": "get",
            "path": case["path"],
            "params": case["params"],
            "pagination": case["pagination"],
            "request_options": None,
            "extra_headers": None,
        }
    ]


@pytest.mark.parametrize("case", ACTION_CASES)
def test_action_methods(case: dict[str, Any]) -> None:
    provider, client = make_provider()
    client.queue(case["operation"], FakeResponse(case["raw"], url=case.get("url", "")))

    result = getattr(provider, case["name"])(**case["kwargs"])

    assert_action_result(result, expected_data=case["expected_data"], raw=case["raw"])
    expected_call = {"operation": case["operation"], "path": case["path"]}
    if "data" in case:
        expected_call["data"] = case["data"]
    if case["operation"] == "get":
        expected_call["params"] = case.get("params")
        expected_call["pagination"] = None
        expected_call["request_options"] = None
        expected_call["extra_headers"] = None
    else:
        if "params" in case:
            expected_call["params"] = case["params"]
        expected_call["headers"] = case.get("headers")
    assert client.calls == [expected_call]


def test_get_pull_request_diff_uses_raw_request_and_extracts_meta() -> None:
    provider, client = make_provider()
    response = FakeResponse(
        {},
        headers={
            "ETag": '"etag-123"',
            "Last-Modified": "Tue, 04 Feb 2026 10:00:00 GMT",
        },
        text="diff --git a/f.py b/f.py",
    )
    client.queue("get", response)

    result = provider.get_pull_request_diff("42")

    assert result["type"] == "github"
    assert result["raw"] == "diff --git a/f.py b/f.py"
    assert result["data"] == "diff --git a/f.py b/f.py"
    assert result["meta"]["etag"] == '"etag-123"'
    assert result["meta"]["last_modified"].isoformat() == "2026-02-04T10:00:00+00:00"
    assert client.calls == [
        {
            "operation": "get",
            "path": "/repos/test-org/test-repo/pulls/42",
            "params": None,
            "pagination": None,
            "request_options": None,
            "extra_headers": {"Accept": "application/vnd.github.v3.diff"},
        }
    ]


@pytest.mark.parametrize("case", VOID_CASES)
def test_void_methods(case: dict[str, Any]) -> None:
    provider, client = make_provider()
    client.queue(case["operation"], {} if case["operation"] == "graphql" else FakeResponse({}))

    result = getattr(provider, case["name"])(**case["kwargs"])

    assert result is None
    if case["operation"] == "graphql":
        assert client.calls == [
            {
                "operation": "graphql",
                "query": case["query"],
                "variables": case["variables"],
            }
        ]
    elif case["operation"] == "post":
        assert client.calls == [
            {
                "operation": "post",
                "path": case["path"],
                "data": case["data"],
                "headers": None,
            }
        ]
    else:
        assert client.calls == [{"operation": "delete", "path": case["path"]}]


@pytest.mark.parametrize("method_name", sorted(ALIAS_METHODS))
def test_alias_methods_delegate_to_issue_methods(method_name: str) -> None:
    delegated_name, kwargs, expected_args, expected_result = ALIAS_METHODS[method_name]
    provider, _ = make_provider()
    delegated = MagicMock(return_value=expected_result)
    setattr(provider, delegated_name, delegated)

    result = getattr(provider, method_name)(**kwargs)

    delegated.assert_called_once_with(*expected_args)
    assert result == expected_result


def test_provider_initialization_wraps_api_client() -> None:
    raw_client = MagicMock(spec=GitHubApiClient)
    repository = make_repository()

    provider = GitHubProvider(raw_client, organization_id=99, repository=repository)

    assert isinstance(provider.client, GitHubProviderApiClient)
    assert provider.organization_id == 99
    assert provider.repository == repository


def test_is_rate_limited_returns_false() -> None:
    provider, _ = make_provider()

    assert provider.is_rate_limited("shared") is False


def test_public_methods_are_accounted_for() -> None:
    covered_methods = {
        "is_rate_limited",
        "get_pull_request_diff",
        *{case["name"] for case in PAGINATED_CASES},
        *{case["name"] for case in ACTION_CASES},
        *{case["name"] for case in VOID_CASES},
        *set(ALIAS_METHODS),
    }
    public_methods = {
        name
        for name, value in GitHubProvider.__dict__.items()
        if callable(value) and not name.startswith("_")
    }

    assert public_methods == covered_methods
