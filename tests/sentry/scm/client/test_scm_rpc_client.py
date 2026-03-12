import datetime
from collections.abc import Callable
from typing import Any, NamedTuple
from unittest import mock

import pytest
import requests
import responses.matchers

from sentry.scm.client.errors import (
    SCMCodedError,
    SCMError,
    SCMProviderException,
    SCMUnhandledException,
)
from sentry.scm.client.scm_rpc_client import SourceCodeManagerRPCClient

shared_secret = "test-shared-secret"
base_url = "http://testserver"
prefix = "api/0/internal/scm-rpc"


@mock.patch("requests.Session")
def test_using_client_as_context_manager_closes_its_owned_session(
    mock_session_class: mock.Mock,
) -> None:
    with SourceCodeManagerRPCClient(
        base_url=base_url,
        shared_secret=shared_secret,
        organization_id=123,
        repository_id=456,
    ) as client:
        pass
    assert client._session is mock_session_class.return_value
    close_method: mock.Mock = mock_session_class.return_value.close
    assert close_method.call_count == 1


@responses.activate
def test_numerical_repository_id_is_sent_as_is() -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/delete_issue_comment_v1/",
        match=[
            responses.matchers.json_params_matcher(
                {
                    "args": {
                        "organization_id": 123,
                        "repository_id": 456,
                        "issue_id": "issue-id",
                        "comment_id": "comment-id",
                    }
                }
            ),
        ],
        json={"data": None},
    )
    client = SourceCodeManagerRPCClient(
        base_url=base_url,
        shared_secret=shared_secret,
        organization_id=123,
        repository_id=456,
    )
    client.delete_issue_comment("issue-id", "comment-id")
    responses.assert_call_count(f"{base_url}/{prefix}/delete_issue_comment_v1/", 1)


@responses.activate
def test_composite_repository_id_is_sent_as_dict() -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/delete_issue_comment_v1/",
        match=[
            responses.matchers.json_params_matcher(
                {
                    "args": {
                        "organization_id": 123,
                        "repository_id": {
                            "provider": "github",
                            "external_id": "456",
                        },
                        "issue_id": "issue-id",
                        "comment_id": "comment-id",
                    }
                }
            ),
        ],
        json={"data": None},
    )
    client = SourceCodeManagerRPCClient(
        base_url=base_url,
        shared_secret=shared_secret,
        organization_id=123,
        repository_id=("github", "456"),
    )
    client.delete_issue_comment("issue-id", "comment-id")
    responses.assert_call_count(f"{base_url}/{prefix}/delete_issue_comment_v1/", 1)


@pytest.fixture
def client() -> SourceCodeManagerRPCClient:
    return SourceCodeManagerRPCClient(
        base_url=base_url,
        shared_secret=shared_secret,
        organization_id=123,
        repository_id=456,
    )


@responses.activate
def test_request_is_signed(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/delete_issue_comment_v1/",
        match=[
            responses.matchers.header_matcher(
                {
                    "Authorization": "rpcsignature rpc0:ed7ba272c1495cebdb65f75df535eb26eaad18aaeb44b3a47b45412f162598f6"
                }
            ),
        ],
        json={"data": None},
    )
    client.delete_issue_comment("issue-id", "comment-id")
    responses.assert_call_count(f"{base_url}/{prefix}/delete_issue_comment_v1/", 1)


@responses.activate
def test_additional_fields_in_rpc_response_are_ignored(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json={
            "data": {
                "data": [
                    {
                        "id": "test-comment-id",
                        "body": "test comment",
                        "author": {"id": "test-author-id", "username": "test author", "foo": "bar"},
                        "additional": "field",
                    }
                ],
                "type": "github",
                "raw": {"foo": "bar"},
                "meta": {"next_cursor": None, "biz": "bir"},
                "bar": "baz",
            }
        },
    )
    assert client.get_issue_comments("test-issue-id") == {
        "data": [
            {
                "id": "test-comment-id",
                "body": "test comment",
                "author": {"id": "test-author-id", "username": "test author"},
            }
        ],
        "type": "github",
        "raw": {"foo": "bar"},
        "meta": {
            "next_cursor": None,
        },
    }

    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_provided_session_is_used() -> None:
    session = requests.Session()
    session.headers["X-Test-Header"] = "test value"
    client = SourceCodeManagerRPCClient(
        base_url=base_url,
        shared_secret=shared_secret,
        organization_id=123,
        repository_id=456,
        session=session,
    )
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/delete_issue_comment_v1/",
        # The custom header from the provided session is included in the request
        match=[
            responses.matchers.header_matcher(
                {
                    "X-Test-Header": "test value",
                }
            ),
        ],
        json={"data": None},
    )
    client.delete_issue_comment("issue-id", "comment-id")
    responses.assert_call_count(f"{base_url}/{prefix}/delete_issue_comment_v1/", 1)


class SimpleSuccessTest(NamedTuple):
    method: Callable
    args: dict[str, Any]
    expected_url: str
    data: Any
    request_data: Any = None


@pytest.mark.parametrize(
    "param",
    [
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_issue_comments,
            {"issue_id": "test-issue-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_issue_comments_v1/",
            [
                {
                    "id": "test-comment-id",
                    "body": "test comment body",
                    "author": {"id": "test-author-id", "username": "test author"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_issue_comment,
            {"issue_id": "test-issue-id", "body": "test comment body"},
            f"{base_url}/{prefix}/create_issue_comment_v1/",
            {
                "id": "test-comment-id",
                "body": "test comment body",
                "author": {"id": "test-author-id", "username": "test author"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_issue_comment,
            {"issue_id": "issue-id", "comment_id": "comment-id"},
            f"{base_url}/{prefix}/delete_issue_comment_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request,
            {"pull_request_id": "pull-request-id", "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_v1/",
            {
                "id": "1",
                "number": "2",
                "title": "test pr",
                "body": "test pr body",
                "state": "open",
                "merged": False,
                "html_url": "http://example.com/pr",
                "head": {"sha": "head-sha", "ref": "head-ref"},
                "base": {"sha": "base-sha", "ref": "base-ref"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_comments,
            {"pull_request_id": "pull-request-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_comments_v1/",
            [
                {
                    "id": "test-comment-id",
                    "body": "test comment",
                    "author": {"id": "test-author-id", "username": "test author"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_pull_request_comment,
            {"pull_request_id": "pull-request-id", "body": "comment body"},
            f"{base_url}/{prefix}/create_pull_request_comment_v1/",
            {
                "id": "test-comment-id",
                "body": "test comment",
                "author": {"id": "test-author-id", "username": "test author"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_pull_request_comment,
            {"pull_request_id": "pull-request-id", "comment_id": "comment-id"},
            f"{base_url}/{prefix}/delete_pull_request_comment_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_issue_comment_reactions,
            {
                "issue_id": "issue-id",
                "comment_id": "comment-id",
                "pagination": None,
                "request_options": None,
            },
            f"{base_url}/{prefix}/get_issue_comment_reactions_v1/",
            [
                {
                    "id": "reaction-id",
                    "content": "+1",
                    "author": {"id": "author-id", "username": "author-username"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_issue_comment_reaction,
            {"issue_id": "issue-id", "comment_id": "comment-id", "reaction": "+1"},
            f"{base_url}/{prefix}/create_issue_comment_reaction_v1/",
            {
                "id": "reaction-id",
                "content": "+1",
                "author": {"id": "author-id", "username": "author-username"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_issue_comment_reaction,
            {"issue_id": "issue-id", "comment_id": "comment-id", "reaction_id": "reaction-id"},
            f"{base_url}/{prefix}/delete_issue_comment_reaction_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_comment_reactions,
            {
                "pull_request_id": "pull-request-id",
                "comment_id": "comment-id",
                "pagination": None,
                "request_options": None,
            },
            f"{base_url}/{prefix}/get_pull_request_comment_reactions_v1/",
            [
                {
                    "id": "reaction-id",
                    "content": "+1",
                    "author": {"id": "test-author-id", "username": "test-author"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_pull_request_comment_reaction,
            {"pull_request_id": "pull-request-id", "comment_id": "comment-id", "reaction": "+1"},
            f"{base_url}/{prefix}/create_pull_request_comment_reaction_v1/",
            {
                "id": "reaction-id",
                "content": "+1",
                "author": {"id": "test-author-id", "username": "test-author"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_pull_request_comment_reaction,
            {
                "pull_request_id": "pull-request-id",
                "comment_id": "comment-id",
                "reaction_id": "reaction-id",
            },
            f"{base_url}/{prefix}/delete_pull_request_comment_reaction_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_issue_reactions,
            {"issue_id": "issue-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_issue_reactions_v1/",
            [
                {
                    "id": "reaction-id",
                    "content": "+1",
                    "author": {"id": "test-author-id", "username": "test-author"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_issue_reaction,
            {"issue_id": "issue-id", "reaction": "+1"},
            f"{base_url}/{prefix}/create_issue_reaction_v1/",
            {
                "id": "reaction-id",
                "content": "+1",
                "author": {"id": "test-author-id", "username": "test-author"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_issue_reaction,
            {"issue_id": "issue-id", "reaction_id": "reaction-id"},
            f"{base_url}/{prefix}/delete_issue_reaction_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_reactions,
            {"pull_request_id": "pull-request-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_reactions_v1/",
            [
                {
                    "id": "reaction-id",
                    "content": "+1",
                    "author": {"id": "test-author-id", "username": "test-author"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_pull_request_reaction,
            {"pull_request_id": "pull-request-id", "reaction": "+1"},
            f"{base_url}/{prefix}/create_pull_request_reaction_v1/",
            {
                "id": "reaction-id",
                "content": "+1",
                "author": {"id": "test-author-id", "username": "test-author"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.delete_pull_request_reaction,
            {"pull_request_id": "pull-request-id", "reaction_id": "reaction-id"},
            f"{base_url}/{prefix}/delete_pull_request_reaction_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_branch,
            {"branch": "branch-name", "request_options": None},
            f"{base_url}/{prefix}/get_branch_v1/",
            {"ref": "ref", "sha": "sha"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_branch,
            {"branch": "branch-name", "sha": "sha"},
            f"{base_url}/{prefix}/create_branch_v1/",
            {"ref": "ref", "sha": "sha"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.update_branch,
            {"branch": "branch", "sha": "sha", "force": False},
            f"{base_url}/{prefix}/update_branch_v1/",
            {"ref": "ref", "sha": "sha"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_git_blob,
            {"content": "content", "encoding": "utf-8"},
            f"{base_url}/{prefix}/create_git_blob_v1/",
            {"sha": "sha"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_file_content,
            {"path": "file-path", "ref": "ref", "request_options": None},
            f"{base_url}/{prefix}/get_file_content_v1/",
            {
                "path": "file-path",
                "sha": "sha",
                "content": "file content",
                "encoding": "utf-8",
                "size": 42,
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_commit,
            {"sha": "sha", "request_options": None},
            f"{base_url}/{prefix}/get_commit_v1/",
            {
                "id": "sha",
                "message": "message",
                "author": {
                    "name": "author",
                    "email": "author@example.com",
                    "date": datetime.datetime(2024, 6, 1, 0, 0, tzinfo=datetime.timezone.utc),
                },
                "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
            },
            {
                "id": "sha",
                "message": "message",
                "author": {
                    "name": "author",
                    "email": "author@example.com",
                    "date": "2024-06-01T00:00:00Z",
                },
                "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_commits,
            {"sha": None, "path": None, "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_commits_v1/",
            [
                {
                    "id": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "author@example.com",
                        "date": datetime.datetime(2024, 6, 1, 0, 0, tzinfo=datetime.timezone.utc),
                    },
                    "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
                },
            ],
            [
                {
                    "id": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "author@example.com",
                        "date": "2024-06-01T00:00:00Z",
                    },
                    "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
                },
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.compare_commits,
            {"start_sha": "start", "end_sha": "end", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/compare_commits_v1/",
            [
                {
                    "id": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "author@example.com",
                        "date": datetime.datetime(2024, 6, 1, 0, 0, tzinfo=datetime.timezone.utc),
                    },
                    "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
                }
            ],
            [
                {
                    "id": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "author@example.com",
                        "date": "2024-06-01T00:00:00Z",
                    },
                    "files": [{"filename": "filename", "status": "changed", "patch": "patch"}],
                }
            ],
            # },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_tree,
            {"tree_sha": "sha", "recursive": True, "request_options": None},
            f"{base_url}/{prefix}/get_tree_v1/",
            {
                "sha": "sha1",
                "tree": [
                    {
                        "path": "file-path",
                        "mode": "100644",
                        "type": "blob",
                        "sha": "sha2",
                        "size": 42,
                    }
                ],
                "truncated": True,
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_git_commit,
            {"sha": "sha", "request_options": None},
            f"{base_url}/{prefix}/get_git_commit_v1/",
            {"sha": "sha", "tree": {"sha": "tree-sha"}, "message": "message"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_git_tree,
            {
                "tree": [{"path": "path", "mode": "mode", "type": "type", "sha": "sha"}],
                "base_tree": "base",
            },
            f"{base_url}/{prefix}/create_git_tree_v1/",
            {
                "sha": "sha1",
                "tree": [
                    {
                        "path": "file-path",
                        "mode": "100644",
                        "type": "blob",
                        "sha": "sha2",
                        "size": 42,
                    }
                ],
                "truncated": True,
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_git_commit,
            {"message": "message", "tree_sha": "tree", "parent_shas": ["sha-1", "sha-2"]},
            f"{base_url}/{prefix}/create_git_commit_v1/",
            {"sha": "sha", "tree": {"sha": "tree-sha"}, "message": "message"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_files,
            {"pull_request_id": "pull-request-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_files_v1/",
            [
                {
                    "filename": "filename",
                    "status": "changed",
                    "patch": "patch",
                    "changes": 3,
                    "sha": "sha",
                    "previous_filename": "previous-name",
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_commits,
            {"pull_request_id": "pr-id", "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_commits_v1/",
            [
                {
                    "sha": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "blah@foo.com",
                        "date": datetime.datetime(2024, 6, 1, 0, 0, tzinfo=datetime.timezone.utc),
                    },
                }
            ],
            [
                {
                    "sha": "sha",
                    "message": "message",
                    "author": {
                        "name": "author",
                        "email": "blah@foo.com",
                        "date": "2024-06-01T00:00:00Z",
                    },
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_request_diff,
            {"pull_request_id": "pr-id", "request_options": None},
            f"{base_url}/{prefix}/get_pull_request_diff_v1/",
            "diff content",
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_pull_requests,
            {"state": "open", "head": None, "pagination": None, "request_options": None},
            f"{base_url}/{prefix}/get_pull_requests_v1/",
            [
                {
                    "id": "1",
                    "number": "2",
                    "title": "test pr",
                    "body": "test pr body",
                    "state": "open",
                    "merged": False,
                    "html_url": "http://example.com/pr",
                    "head": {"sha": "head-sha", "ref": "head-ref"},
                    "base": {"sha": "base-sha", "ref": "base-ref"},
                }
            ],
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_pull_request,
            {"title": "title", "body": "body", "head": "head", "base": "base", "draft": False},
            f"{base_url}/{prefix}/create_pull_request_v1/",
            {
                "id": "1",
                "number": "2",
                "title": "test pr",
                "body": "test pr body",
                "state": "open",
                "merged": False,
                "html_url": "http://example.com/pr",
                "head": {"sha": "head-sha", "ref": "head-ref"},
                "base": {"sha": "base-sha", "ref": "base-ref"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.update_pull_request,
            {"pull_request_id": "pr-id", "title": "title", "body": "body", "state": "state"},
            f"{base_url}/{prefix}/update_pull_request_v1/",
            {
                "id": "1",
                "number": "2",
                "title": "test pr",
                "body": "test pr body",
                "state": "open",
                "merged": False,
                "html_url": "http://example.com/pr",
                "head": {"sha": "head-sha", "ref": "head-ref"},
                "base": {"sha": "base-sha", "ref": "base-ref"},
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.request_review,
            {"pull_request_id": "pull-request-id", "reviewers": ["reviewer1", "reviewer2"]},
            f"{base_url}/{prefix}/request_review_v1/",
            None,
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_review_comment_file,
            {
                "pull_request_id": "pr-id",
                "commit_id": "sha",
                "body": "body",
                "path": "path",
                "side": "LEFT",
            },
            f"{base_url}/{prefix}/create_review_comment_file_v1/",
            {"id": "73", "html_url": "http://blah", "path": "path", "body": "comment body"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_review_comment_reply,
            {
                "pull_request_id": "pr-id",
                "body": "body",
                "comment_id": "1",
            },
            f"{base_url}/{prefix}/create_review_comment_reply_v1/",
            {"id": "73", "html_url": "http://blah", "path": "path", "body": "comment body"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_review,
            {
                "pull_request_id": "pr-id",
                "commit_sha": "sha",
                "event": "frob",
                "comments": [
                    {
                        "path": "path",
                        "body": "body",
                        "line": 42,
                        "start_line": 57,
                        "start_side": "left",
                    }
                ],
                "body": "body",
            },
            f"{base_url}/{prefix}/create_review_v1/",
            {"id": "73", "html_url": "http://blah"},
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.create_check_run,
            {
                "name": "name",
                "head_sha": "sha",
                "status": "status",
                "conclusion": "ok",
                "external_id": "blah",
                "started_at": "",
                "completed_at": "",
                "output": {"title": "title", "summary": "summary", "text": "text"},
            },
            f"{base_url}/{prefix}/create_check_run_v1/",
            {
                "id": "73",
                "name": "name",
                "status": "pending",
                "conclusion": "unknown",
                "html_url": "http://blah",
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.get_check_run,
            {"check_run_id": "chk-id", "request_options": None},
            f"{base_url}/{prefix}/get_check_run_v1/",
            {
                "id": "73",
                "name": "name",
                "status": "pending",
                "conclusion": "unknown",
                "html_url": "http://blah",
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.update_check_run,
            {
                "check_run_id": "chk-id",
                "status": "status",
                "conclusion": "unknown",
                "output": {"title": "title", "summary": "summary", "text": "text"},
            },
            f"{base_url}/{prefix}/update_check_run_v1/",
            {
                "id": "73",
                "name": "name",
                "status": "pending",
                "conclusion": "unknown",
                "html_url": "http://blah",
            },
        ),
        SimpleSuccessTest(
            SourceCodeManagerRPCClient.minimize_comment,
            {"comment_node_id": "comment-node-id", "reason": "reason"},
            f"{base_url}/{prefix}/minimize_comment_v1/",
            None,
        ),
    ],
    ids=lambda param: param.expected_url.split("/")[-2],
)
@responses.activate
def test_simple_success(
    client: SourceCodeManagerRPCClient,
    param: SimpleSuccessTest,
) -> None:
    if "pagination" in param.args:
        meta = {"next_cursor": None}
    else:
        meta = {}
    if param.data is None:
        expected_result = None
    else:
        expected_result = {
            "type": "github",
            "raw": {"foo": "bar"},
            "data": param.data,
            "meta": meta,
        }
    if param.request_data is None:
        body_data = expected_result
    else:
        body_data = {
            "type": "github",
            "raw": {"foo": "bar"},
            "data": param.request_data,
            "meta": meta,
        }
    responses.add(
        responses.POST,
        param.expected_url,
        match=[
            responses.matchers.json_params_matcher(
                {
                    "args": {
                        "organization_id": 123,
                        "repository_id": 456,
                    }
                    | param.args
                }
            ),
        ],
        json={"data": body_data},
    )
    # With keywords arguments
    assert param.method(client, **param.args) == expected_result
    # With positional arguments
    assert param.method(client, *param.args.values()) == expected_result
    responses.assert_call_count(param.expected_url, 2)


@responses.activate
def test_non_json_response_raises_unhandled_exception(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        status=299,
        body="non-json response",
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == ("Response was not JSON", 299, "non-json response")
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_invalid_json_response_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        status=299,
        json={"errors": 42},
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == ("Response did not match expected schema", 299, {"errors": 42})
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_empty_response_raises_unhandled_exception(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        status=299,
        json={},
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == ("Response did not match expected schema", 299, {})
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_dict_instead_of_list_in_response_data_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    body = {"data": {"type": "github", "raw": {"foo": "bar"}, "data": {}}}
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        status=299,
        json=body,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "Response data did not match expected return type",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_none_instead_of_list_response_data_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    body = {"data": None}
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        status=299,
        json=body,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "Response data did not match expected return type",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_empty_dict_instead_of_comment_in_response_data_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    body = {"data": {"type": "github", "raw": {"foo": "bar"}, "data": {}}}
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/create_issue_comment_v1/",
        status=299,
        json=body,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.create_issue_comment("test-issue-id", "comment body")
    assert exc.value.args == (
        "Response data did not match expected return type",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/create_issue_comment_v1/", 1)


@responses.activate
def test_none_instead_of_dict_response_data_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    body = {"data": None}
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/create_issue_comment_v1/",
        status=299,
        json=body,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.create_issue_comment("test-issue-id", "comment body")
    assert exc.value.args == (
        "Response data did not match expected return type",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/create_issue_comment_v1/", 1)


@responses.activate
def test_dict_instead_of_none_response_data_raises_unhandled_exception(
    client: SourceCodeManagerRPCClient,
) -> None:
    body = {"data": {"type": "github", "raw": {"foo": "bar"}, "data": {}}}
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/delete_issue_comment_v1/",
        status=299,
        json=body,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.delete_issue_comment("issue-id", "comment-id")
    assert exc.value.args == (
        "Response data did not match expected return type",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/delete_issue_comment_v1/", 1)


@responses.activate
def test_scm_coded_error_is_raised_as_is(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json={
            "errors": [
                {
                    "type": "SCMCodedError",
                    "details": [
                        "repository_not_found",
                        "A repository could not be found.",
                        "Blah",
                        68,
                    ],
                }
            ]
        },
        status=400,
    )
    with pytest.raises(SCMCodedError) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "repository_not_found",
        "A repository could not be found.",
        "Blah",
        68,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_scm_provider_exception_is_raised_as_is(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json={
            "errors": [
                {
                    "type": "SCMProviderException",
                    "details": [
                        "A provider error occurred.",
                        "Blah",
                        68,
                    ],
                }
            ]
        },
        status=500,
    )
    with pytest.raises(SCMProviderException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "A provider error occurred.",
        "Blah",
        68,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_scm_error_is_raised_as_is(client: SourceCodeManagerRPCClient) -> None:
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json={
            "errors": [
                {
                    "type": "SCMError",
                    "details": [
                        "A generic SCM error occurred.",
                        "Blah",
                        68,
                    ],
                }
            ]
        },
        status=500,
    )
    with pytest.raises(SCMError) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "A generic SCM error occurred.",
        "Blah",
        68,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_unknown_error_type_raises_unhandled_exception(client: SourceCodeManagerRPCClient) -> None:
    body = {
        "errors": [
            {
                "type": "UnknownErrorType",
                "details": [
                    "Some unknown error occurred.",
                    "Blah",
                    68,
                ],
            }
        ]
    }
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json=body,
        status=299,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == (
        "Unknown error type: UnknownErrorType",
        299,
        body,
    )
    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)


@responses.activate
def test_multiple_errors_raises_unhandled_exception(client: SourceCodeManagerRPCClient) -> None:
    body = {
        "errors": [
            {
                "type": "SCMCodedError",
                "details": [
                    "repository_not_found",
                    "A repository could not be found.",
                    "Blah",
                    68,
                ],
            },
            {
                "type": "SCMCodedError",
                "details": [
                    "repository_not_found",
                    "A repository could not be found.",
                    "Blah",
                    68,
                ],
            },
        ]
    }
    responses.add(
        responses.POST,
        f"{base_url}/{prefix}/get_issue_comments_v1/",
        json=body,
        status=400,
    )
    with pytest.raises(SCMUnhandledException) as exc:
        client.get_issue_comments("test-issue-id")
    assert exc.value.args == ("Multiple errors returned", 400, body)

    responses.assert_call_count(f"{base_url}/{prefix}/get_issue_comments_v1/", 1)
